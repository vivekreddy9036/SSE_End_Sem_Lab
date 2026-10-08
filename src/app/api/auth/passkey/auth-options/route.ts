import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verify2faPendingToken,
  get2faCookieName,
} from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/utils";
import { getAuthenticationOptions } from "@/lib/passkey";
import { isAccountLocked } from "@/lib/totp";

/**
 * POST /api/auth/passkey/auth-options
 *
 * Returns WebAuthn authentication options (challenge + allowed credentials).
 * Requires a valid 2fa_pending cookie (issued after password check).
 */
export async function POST(req: NextRequest) {
  try {
    const pendingToken = req.cookies.get(get2faCookieName())?.value;
    if (!pendingToken) {
      return apiError("No pending 2FA session. Please log in again.", 401);
    }

    const pending = await verify2faPendingToken(pendingToken);
    if (!pending) {
      return apiError("2FA session expired. Please log in again.", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: pending.userId },
      select: { id: true, isActive: true, totpLockedUntil: true },
    });

    if (!user || !user.isActive) {
      return apiError("Account not found or deactivated", 401);
    }

    if (isAccountLocked(user.totpLockedUntil)) {
      return apiError(
        "Account temporarily locked due to too many failed attempts. Try again later.",
        423
      );
    }

    const options = await getAuthenticationOptions(pending.userId);

    return apiSuccess(options, "Authentication options generated");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Passkey auth-options error:", error);
    return apiError(message, 500);
  }
}
