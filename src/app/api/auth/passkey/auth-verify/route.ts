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
import { verifyAuthentication, getOriginFromRequest } from "@/lib/passkey";
import {
  isAccountLocked,
  MAX_FAILED_ATTEMPTS,
  getLockoutExpiry,
} from "@/lib/totp";
import { auditLog, getClientIpFromRequest, resolveLoginLocation } from "@/lib/audit";

/**
 * POST /api/auth/passkey/auth-verify
 *
 * Verifies a passkey authentication response during login.
 * Requires a valid 2fa_pending cookie.
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
    const { credential, lat: browserLat, lng: browserLng } = body as {
      credential: unknown;
      lat?: number;
      lng?: number;
    };

    if (!credential) {
      return apiError("Missing passkey credential data", 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: pending.userId },
      include: { role: true, branch: true },
    });

    if (!user || !user.isActive) {
      return apiError("Account not found or deactivated", 401);
    }

    const ip = getClientIpFromRequest(req);

    if (isAccountLocked(user.totpLockedUntil)) {
      auditLog(user.id, "PASSKEY_AUTH_FAILED", "Account locked", ip);
      return apiError(
        "Account temporarily locked due to too many failed attempts. Try again in 15 minutes.",
        423
      );
    }

    const origin = getOriginFromRequest(req);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await verifyAuthentication(user.id, credential as any, origin);
    } catch {
      // Passkey verification failed — increment failed counter (shared with TOTP)
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

      auditLog(user.id, "PASSKEY_AUTH_FAILED", "Invalid passkey response", ip);

      const remaining = MAX_FAILED_ATTEMPTS - newFailedCount;
      if (remaining > 0) {
        return apiError(
          `Passkey verification failed. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
          401
        );
      }
      return apiError(
        "Account locked due to too many failed attempts. Try again in 15 minutes.",
        423
      );
    }

    // ── Success ──
    await prisma.user.update({
      where: { id: user.id },
      data: {
        totpFailedCount: 0,
        totpLockedUntil: null,
      },
    });

    // Enforce both methods are fully set up before issuing a session.
    // If TOTP is not yet enabled the user registered a passkey but never
    // completed the authenticator-app step.  Keep the 2fa_pending cookie
    // alive and tell the UI to resume setup.
    if (!user.totpEnabled) {
      auditLog(user.id, "PASSKEY_AUTH_SUCCESS", "Passkey verified (setup incomplete)", ip);
      return apiSuccess(
        { setupRequired: true, missingMethod: "totp" },
        "Passkey verified. Please complete authenticator app setup."
      );
    }

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

    const geo = await resolveLoginLocation(ip, browserLat, browserLng);
    await prisma.user.update({
      where: { id: user.id },
      data: {
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
    auditLog(user.id, "LOGIN_SUCCESS", "Via passkey", ip);
    auditLog(user.id, "PASSKEY_AUTH_SUCCESS", undefined, ip);

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
      },
      "Login successful"
    );

    response.headers.append("Set-Cookie", buildAccessCookie(accessToken));
    response.headers.append("Set-Cookie", buildRefreshCookie(refreshToken));
    response.headers.append("Set-Cookie", buildClear2faPendingCookie());

    return response;
  } catch (error) {
    console.error("Passkey auth-verify error:", error);
    return apiError("Internal server error", 500);
  }
}
