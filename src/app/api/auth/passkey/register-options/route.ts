import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verify2faPendingToken,
  get2faCookieName,
} from "@/lib/auth";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/utils";
import { getRegistrationOptions } from "@/lib/passkey";

/**
 * POST /api/auth/passkey/register-options
 *
 * Returns WebAuthn registration options (challenge, RP info, etc.).
 * Works for both:
 *   - First-time setup during login (2fa_pending cookie)
 *   - Authenticated users adding a new passkey
 */
export async function POST(req: NextRequest) {
  try {
    let userId: number;
    let username: string;

    // Try authenticated session first
    const session = await requireAuth(req);
    if (session instanceof Response) {
      // Not authenticated — check for 2fa_pending cookie (login flow)
      const pendingToken = req.cookies.get(get2faCookieName())?.value;
      if (!pendingToken) {
        return apiError("Unauthorized", 401);
      }
      const pending = await verify2faPendingToken(pendingToken);
      if (!pending) {
        return apiError("Session expired. Please log in again.", 401);
      }
      const user = await prisma.user.findUnique({
        where: { id: pending.userId },
        select: { id: true, username: true, isActive: true },
      });
      if (!user || !user.isActive) {
        return apiError("Account not found or deactivated", 401);
      }
      userId = user.id;
      username = user.username;
    } else {
      userId = session.userId;
      username = session.username;
    }

    const options = await getRegistrationOptions(userId, username);

    return apiSuccess(options, "Registration options generated");
  } catch (error) {
    console.error("Passkey register-options error:", error);
    return apiError("Internal server error", 500);
  }
}
