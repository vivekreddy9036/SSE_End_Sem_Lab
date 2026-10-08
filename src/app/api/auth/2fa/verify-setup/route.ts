import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verify2faPendingToken,
  get2faCookieName,
  signAccessToken,
  signRefreshToken,
  buildAccessCookie,
  buildRefreshCookie,
  buildClear2faPendingCookie,
} from "@/lib/auth";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/utils";
import {
  decryptTotpSecret,
  verifyTotpToken,
  generateRecoveryCodes,
  isAccountLocked,
  MAX_FAILED_ATTEMPTS,
  getLockoutExpiry,
} from "@/lib/totp";
import { auditLog, getClientIpFromRequest, resolveLoginLocation } from "@/lib/audit";

/**
 * POST /api/auth/2fa/verify-setup
 *
 * Verifies the first OTP after scanning QR code.
 * Enables 2FA and returns recovery codes.
 * Issues full JWT session if coming from login flow.
 */
export async function POST(req: NextRequest) {
  try {
    let userId: number;
    let isLoginFlow = false;

    const session = await requireAuth(req);
    if (session instanceof Response) {
      const pendingToken = req.cookies.get(get2faCookieName())?.value;
      if (!pendingToken) {
        return apiError("Unauthorized", 401);
      }
      const pending = await verify2faPendingToken(pendingToken);
      if (!pending) {
        return apiError("Session expired. Please log in again.", 401);
      }
      userId = pending.userId;
      isLoginFlow = true;
    } else {
      userId = session.userId;
    }

    const body = await req.json();
    const { token, lat: browserLat, lng: browserLng } = body as { token: string; lat?: number; lng?: number };

    if (!token || token.length !== 6) {
      return apiError("Please enter a valid 6-digit code", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true, branch: true },
    });

    if (!user || !user.totpSecret) {
      return apiError("2FA setup not initiated. Please start setup first.", 400);
    }

    const ip = getClientIpFromRequest(req);

    if (isAccountLocked(user.totpLockedUntil)) {
      auditLog(user.id, "TOTP_VERIFY_FAILED", "Account locked", ip);
      return apiError(
        "Account temporarily locked due to too many failed attempts. Try again later.",
        423
      );
    }

    const secret = decryptTotpSecret(user.totpSecret);
    const isValid = verifyTotpToken(secret, token);

    if (!isValid) {
      const newFailedCount = user.totpFailedCount + 1;
      const updateData: Record<string, unknown> = {
        totpFailedCount: newFailedCount,
      };

      if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
        updateData.totpLockedUntil = getLockoutExpiry();
        auditLog(user.id, "TOTP_ACCOUNT_LOCKED", `Failed attempts: ${newFailedCount}`, ip);
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      auditLog(user.id, "TOTP_VERIFY_FAILED", "Invalid OTP during setup verification", ip);
      return apiError("Invalid verification code. Please try again.", 401);
    }

    // OTP valid — enable 2FA and generate recovery codes
    const { plaintext: recoveryCodes, hashed: hashedCodes } =
      await generateRecoveryCodes();

    const geo = await resolveLoginLocation(ip, browserLat, browserLng);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpEnabled: true,
        totpFailedCount: 0,
        totpLockedUntil: null,
        totpBackupCodes: JSON.stringify(hashedCodes),
        lastLogin: new Date(),
        lastLoginIp: ip,
        lastLoginLocation: geo.location || null,
        lastLoginLat: geo.lat,
        lastLoginLng: geo.lng,
        lastLoginAddress: geo.address,
        lastLoginPincode: geo.pincode,
        lastLoginCity: geo.city,
        lastLoginState: geo.state,
        lastLoginCountry: geo.country,
        lastLoginSource: geo.source,
      },
    });

    auditLog(user.id, "TOTP_SETUP_COMPLETED", undefined, ip);

    // If this is the login flow, issue full JWT tokens
    if (isLoginFlow) {
      const jwtPayload = {
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        roleId: user.roleId,
        roleCode: user.role.code,
        isSupervisory: user.role.isSupervisory,
        branchId: user.branchId,
        branchCode: user.branch.code,
      };

      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken(jwtPayload),
        signRefreshToken(user.id),
      ]);

      auditLog(user.id, "LOGIN_SUCCESS", "After 2FA setup", ip);

      const response = apiSuccess(
        {
          user: {
            userId: user.id,
            username: user.username,
            fullName: user.fullName,
            roleCode: user.role.code,
            isSupervisory: user.role.isSupervisory,
            branchId: user.branchId,
            branchCode: user.branch.code,
          },
          recoveryCodes,
        },
        "2FA enabled successfully"
      );

      response.headers.append("Set-Cookie", buildAccessCookie(accessToken));
      response.headers.append("Set-Cookie", buildRefreshCookie(refreshToken));
      response.headers.append("Set-Cookie", buildClear2faPendingCookie());

      return response;
    }

    // Already authenticated — just return recovery codes
    return apiSuccess(
      { recoveryCodes },
      "2FA enabled successfully"
    );
  } catch (error) {
    console.error("2FA verify-setup error:", error);
    return apiError("Internal server error", 500);
  }
}
