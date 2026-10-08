import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/utils";
import { applyRateLimit, LOGIN_RATE_LIMIT } from "@/lib/rate-limit";
import { createPasswordResetToken } from "@/lib/password-reset";
import { auditLog, getClientIpFromRequest } from "@/lib/audit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  turnstileToken: z.string().min(1),
});

async function verifyTurnstile(token: string): Promise<boolean> {
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: token,
      }),
    }
  );
  const data = (await res.json()) as { success: boolean };
  return data.success;
}

/**
 * POST /api/auth/forgot-password
 *
 * Always returns the same success message whether or not the email exists —
 * account enumeration via this endpoint is exactly how an attacker maps out
 * which emails are valid targets before trying credential stuffing. The raw
 * reset token (when a matching account exists) would normally be emailed;
 * since this project has no mail service wired up, it's returned in the dev
 * response and logged server-side instead — never persisted in plaintext.
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimited = applyRateLimit(req, LOGIN_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const { email, turnstileToken } = parsed.data;

    const captchaOk = await verifyTurnstile(turnstileToken);
    if (!captchaOk) {
      return apiError("CAPTCHA verification failed. Please try again.", 400);
    }

    const ip = getClientIpFromRequest(req);
    const user = await prisma.user.findUnique({ where: { email } });

    let devToken: string | undefined;
    if (user && user.isActive) {
      const rawToken = await createPasswordResetToken(user.id, ip);
      auditLog(user.id, "PASSWORD_RESET_REQUESTED", undefined, ip);
      console.log(
        `[password-reset] no mail service configured — reset link for ${email}: /reset-password?token=${rawToken}`
      );
      if (process.env.NODE_ENV !== "production") devToken = rawToken;
    }

    return apiSuccess(
      { devToken },
      "If an account exists for that email, a reset link has been sent."
    );
  } catch (error) {
    console.error("Forgot-password error:", error);
    return apiError("Internal server error", 500);
  }
}
