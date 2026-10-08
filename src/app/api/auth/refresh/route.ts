import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  buildAccessCookie,
  buildRefreshCookie,
  buildClearAccessCookie,
  buildClearRefreshCookie,
  getRefreshTokenName,
} from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/utils";
import { getEffectivePermissions } from "@/lib/authz";

/**
 * POST /api/auth/refresh
 * Uses the refresh token cookie to issue a new access + refresh token pair.
 * This is called automatically by the AuthProvider when a 401 is detected.
 *
 * Permissions are recomputed from the DB on every refresh (not copied from
 * the old access token) — this is the main place a revoked permission or
 * role change actually takes effect, since the 15-minute access token
 * itself can't be revoked early.
 */
export async function POST(req: NextRequest) {
  try {
    const refreshCookie = req.cookies.get(getRefreshTokenName())?.value;

    if (!refreshCookie) {
      return apiError("No refresh token", 401);
    }

    const payload = await verifyRefreshToken(refreshCookie);
    if (!payload) {
      // Invalid/expired refresh token — force re-login
      const response = apiError("Session expired. Please log in again.", 401);
      response.headers.append("Set-Cookie", buildClearAccessCookie());
      response.headers.append("Set-Cookie", buildClearRefreshCookie());
      return response;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      const response = apiError("Account deactivated", 401);
      response.headers.append("Set-Cookie", buildClearAccessCookie());
      response.headers.append("Set-Cookie", buildClearRefreshCookie());
      return response;
    }

    const permissions = await getEffectivePermissions(user.id);

    const jwtPayload = {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      roleId: user.roleId,
      roleCode: user.role.code,
      permissions,
    };

    // Rotate both tokens
    const [newAccessToken, newRefreshToken] = await Promise.all([
      signAccessToken(jwtPayload),
      signRefreshToken(user.id),
    ]);

    const response = apiSuccess(
      {
        user: {
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
          roleCode: user.role.code,
          permissions,
          lastLoginLocation: user.lastLoginLocation ?? null,
          lastLoginIp: user.lastLoginIp ?? null,
          lastLoginLat: user.lastLoginLat ?? null,
          lastLoginLng: user.lastLoginLng ?? null,
          lastLoginAddress: user.lastLoginAddress ?? null,
          lastLoginPincode: user.lastLoginPincode ?? null,
          lastLoginCity: user.lastLoginCity ?? null,
          lastLoginState: user.lastLoginState ?? null,
          lastLoginCountry: user.lastLoginCountry ?? null,
          lastLoginSource: user.lastLoginSource ?? null,
        },
      },
      "Token refreshed"
    );

    response.headers.append("Set-Cookie", buildAccessCookie(newAccessToken));
    response.headers.append("Set-Cookie", buildRefreshCookie(newRefreshToken));

    return response;
  } catch (error) {
    console.error("Refresh error:", error);
    return apiError("Internal server error", 500);
  }
}
