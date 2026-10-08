import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { verify2faPendingToken, get2faCookieName } from "@/lib/auth";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/utils";
import {
  generateTotpSecret,
  generateTotpUri,
  encryptTotpSecret,
  decryptTotpSecret,
  verifyTotpToken,
  generateRecoveryCodes,
} from "@/lib/totp";
import { auditLog, getClientIpFromRequest } from "@/lib/audit";

/**
 * POST /api/auth/2fa/setup
 *
 * Called in two scenarios:
 * 1. During first login (user has 2fa_pending cookie but no full session)
 * 2. User is already authenticated and wants to re-setup 2FA
 *
 * Returns the TOTP secret, QR code data URL, and otpauth URI.
 */
export async function POST(req: NextRequest) {
  try {
    // Try full session first, then fall back to 2fa_pending cookie
    let userId: number;

    const session = await requireAuth(req);
    if (session instanceof Response) {
      // No full session — check for 2fa pending cookie
      const pendingToken = req.cookies.get(get2faCookieName())?.value;
      if (!pendingToken) {
        return apiError("Unauthorized", 401);
      }
      const pending = await verify2faPendingToken(pendingToken);
      if (!pending) {
        return apiError("Session expired. Please log in again.", 401);
      }
      userId = pending.userId;
    } else {
      userId = session.userId;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, totpEnabled: true, totpSecret: true },
    });

    if (!user) {
      return apiError("User not found", 404);
    }

    // Generate a new secret (or reuse pending one if setup was started but not completed)
    let secret: string;

    if (user.totpSecret && !user.totpEnabled) {
      // Setup was started but never completed — reuse same secret
      secret = decryptTotpSecret(user.totpSecret);
    } else if (user.totpEnabled) {
      // Already enabled — generate new secret for re-setup
      secret = generateTotpSecret();
      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: encryptTotpSecret(secret), totpEnabled: false },
      });
    } else {
      // Fresh setup
      secret = generateTotpSecret();
      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: encryptTotpSecret(secret) },
      });
    }

    const otpauthUri = generateTotpUri(secret, user.username);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri, {
      width: 256,
      margin: 2,
      color: { dark: "#000000", light: "#FFFFFF" },
    });

    const ip = getClientIpFromRequest(req);
    auditLog(user.id, "TOTP_SETUP_STARTED", undefined, ip);

    return apiSuccess({
      qrCode: qrCodeDataUrl,
      secret, // Show to user so they can manually enter if QR scan fails
      otpauthUri,
    });
  } catch (error) {
    console.error("2FA setup error:", error);
    return apiError("Internal server error", 500);
  }
}
