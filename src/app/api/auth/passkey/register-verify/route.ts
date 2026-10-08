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
import { verifyAndSaveRegistration, getOriginFromRequest } from "@/lib/passkey";
import { auditLog, getClientIpFromRequest } from "@/lib/audit";

/**
 * POST /api/auth/passkey/register-verify
 *
 * Verifies the passkey registration response from the browser.
 * Saves the credential and enables passkey auth.
 *
 * Body: { credential, friendlyName?, setupOnly? }
 *
 * - setupOnly=true (multi-step setup): registers passkey, keeps 2fa_pending cookie alive
 *   so user can proceed to TOTP setup next.
 * - setupOnly=false/absent: registers passkey and issues JWT (single-method or auth'd flow).
 * - Authenticated users: just registers the passkey.
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
    const { credential, friendlyName, setupOnly } = body as {
      credential: unknown;
      friendlyName?: string;
      setupOnly?: boolean;
    };

    if (!credential) {
      return apiError("Missing passkey credential data", 400);
    }

    const ip = getClientIpFromRequest(req);
    const origin = getOriginFromRequest(req);

    // Verify and save the registration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await verifyAndSaveRegistration(userId, credential as any, friendlyName, origin);

    auditLog(userId, "PASSKEY_REGISTERED", friendlyName || "Unnamed passkey", ip);

    // ── setupOnly mode: passkey registered, but user still needs to set up TOTP ──
    // Keep 2fa_pending cookie alive so the next setup step can use it.
    if (isLoginFlow && setupOnly) {
      return apiSuccess(
        { registered: true },
        "Passkey registered. Continue to authenticator app setup."
      );
    }

    // ── Full login flow: passkey is the only 2FA method ──
    if (isLoginFlow) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true, branch: true },
      });

      if (!user) {
        return apiError("Account not found", 401);
      }

      await prisma.user.update({
        where: { id: userId },
        data: { lastLogin: new Date() },
      });

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

      auditLog(user.id, "LOGIN_SUCCESS", "After passkey setup", ip);

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
        "Passkey registered successfully"
      );

      response.headers.append("Set-Cookie", buildAccessCookie(accessToken));
      response.headers.append("Set-Cookie", buildRefreshCookie(refreshToken));
      response.headers.append("Set-Cookie", buildClear2faPendingCookie());

      return response;
    }

    // Authenticated user flow — just confirm registration
    return apiSuccess({ registered: true }, "Passkey registered successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Passkey register-verify error:", error);
    return apiError(message, message.includes("expired") ? 401 : 500);
  }
}
