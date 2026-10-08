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
import { apiSuccess, apiError } from "@/lib/utils";
import {
  decryptTotpSecret,
  verifyTotpToken,
  verifyRecoveryCode,
  isAccountLocked,
  MAX_FAILED_ATTEMPTS,
  getLockoutExpiry,
} from "@/lib/totp";
import { auditLog, getClientIpFromRequest, resolveLoginLocation } from "@/lib/audit";
import { getEffectivePermissions } from "@/lib/authz";

/**
 * POST /api/auth/2fa/verify
 *
 * Verifies OTP or recovery code during login.
 * Requires a valid 2fa_pending cookie (issued after password check).
 * On success, issues full JWT access + refresh tokens.
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

    const body = await req.json();
    const { token, recoveryCode, lat: browserLat, lng: browserLng } = body as {
      token?: string;
      recoveryCode?: string;
      lat?: number;
      lng?: number;
    };

    if (!token && !recoveryCode) {
      return apiError("Please provide an OTP code or recovery code", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: pending.userId },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      return apiError("Account not found or deactivated", 401);
    }

    const ip = getClientIpFromRequest(req);

    // Check lockout
    if (isAccountLocked(user.totpLockedUntil)) {
      auditLog(user.id, "TOTP_VERIFY_FAILED", "Account locked", ip);
      return apiError(
        "Account temporarily locked due to too many failed attempts. Try again in 15 minutes.",
        423
      );
    }

    let verified = false;
    let isRecovery = false;

    if (recoveryCode) {
      // ── Recovery code flow ──
      if (!user.totpBackupCodes) {
        return apiError("No recovery codes available", 400);
      }

      const hashedCodes: string[] = JSON.parse(user.totpBackupCodes);
      const matchIndex = await verifyRecoveryCode(recoveryCode, hashedCodes);

      if (matchIndex >= 0) {
        verified = true;
        isRecovery = true;
        // Invalidate the used recovery code
        hashedCodes[matchIndex] = "";
        await prisma.user.update({
          where: { id: user.id },
          data: { totpBackupCodes: JSON.stringify(hashedCodes) },
        });
        auditLog(user.id, "TOTP_RECOVERY_USED", `Code index: ${matchIndex}`, ip);
      }
    } else if (token) {
      // ── TOTP code flow ──
      if (!user.totpSecret) {
        return apiError("2FA not configured", 400);
      }

      const secret = decryptTotpSecret(user.totpSecret);
      verified = verifyTotpToken(secret, token);
    }

    if (!verified) {
      const newFailedCount = user.totpFailedCount + 1;
      const updateData: Record<string, unknown> = {
        totpFailedCount: newFailedCount,
      };

      if (newFailedCount >= MAX_FAILED_ATTEMPTS) {
        updateData.totpLockedUntil = getLockoutExpiry();
        auditLog(
          user.id,
          "TOTP_ACCOUNT_LOCKED",
          `Failed attempts: ${newFailedCount}`,
          ip
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      auditLog(user.id, "TOTP_VERIFY_FAILED", "Invalid OTP during login", ip);

      const remaining = MAX_FAILED_ATTEMPTS - newFailedCount;
      if (remaining > 0) {
        return apiError(
          `Invalid code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
          401
        );
      }
      return apiError(
        "Account locked due to too many failed attempts. Try again in 15 minutes.",
        423
      );
    }

    // ── Success: issue full session ──
    const geo = await resolveLoginLocation(ip, browserLat, browserLng);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpFailedCount: 0,
        totpLockedUntil: null,
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

    const permissions = await getEffectivePermissions(user.id);

    const jwtPayload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId,
      roleCode: user.role.code,
      permissions,
    };

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(jwtPayload),
      signRefreshToken(user.id),
    ]);

    auditLog(
      user.id,
      "LOGIN_SUCCESS",
      isRecovery ? "Via recovery code" : "Via TOTP",
      ip
    );
    auditLog(user.id, "TOTP_VERIFY_SUCCESS", undefined, ip);

    const response = apiSuccess(
      {
        user: {
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
          roleCode: user.role.code,
          permissions,
        },
      },
      "Login successful"
    );

    response.headers.append("Set-Cookie", buildAccessCookie(accessToken));
    response.headers.append("Set-Cookie", buildRefreshCookie(refreshToken));
    response.headers.append("Set-Cookie", buildClear2faPendingCookie());

    return response;
  } catch (error) {
    console.error("2FA verify error:", error);
    return apiError("Internal server error", 500);
  }
}
