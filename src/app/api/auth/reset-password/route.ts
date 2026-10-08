import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/utils";
import { consumePasswordResetToken } from "@/lib/password-reset";
import { auditLog, getClientIpFromRequest } from "@/lib/audit";

const schema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(10).max(128),
});

/**
 * POST /api/auth/reset-password
 * Consumes a single-use reset token and sets a new password. Also clears
 * the password-login lockout so a user who was locked out (and is the
 * reason they're resetting) isn't still stuck after proving account
 * ownership via the emailed token.
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const { token, newPassword } = parsed.data;

    const consumed = await consumePasswordResetToken(token);
    const ip = getClientIpFromRequest(req);

    if (!consumed) {
      return apiError("This reset link is invalid or has expired.", 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: consumed.userId },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });

    auditLog(consumed.userId, "PASSWORD_RESET_COMPLETED", undefined, ip);

    return apiSuccess(null, "Password updated. You can now sign in.");
  } catch (error) {
    console.error("Reset-password error:", error);
    return apiError("Internal server error", 500);
  }
}
