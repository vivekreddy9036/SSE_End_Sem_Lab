import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { apiCreated, apiError } from "@/lib/utils";
import { applyRateLimit, LOGIN_RATE_LIMIT } from "@/lib/rate-limit";
import { auditLog, getClientIpFromRequest } from "@/lib/audit";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(128),
  fullName: z.string().trim().min(1).max(150),
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
 * POST /api/auth/register
 *
 * Self-service registration. New accounts are created with the baseline
 * "USER" role, which (per the seeded Role->Permission mapping) grants no
 * resource access at all — a new user must go through the Access Request
 * workflow to gain anything. This keeps registration low-risk: there is no
 * "register as Admin" path, because the role is hardcoded here, never
 * taken from the request body.
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimited = applyRateLimit(req, LOGIN_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const parsed = registerSchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
    }
    const { email, password, fullName, turnstileToken } = parsed.data;

    const captchaOk = await verifyTurnstile(turnstileToken);
    if (!captchaOk) {
      return apiError("CAPTCHA verification failed. Please try again.", 400);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Same generic message either way — don't confirm account existence.
      return apiError("Unable to create account with these details.", 400);
    }

    const userRole = await prisma.role.findUnique({ where: { code: "USER" } });
    if (!userRole) {
      return apiError("Registration is temporarily unavailable.", 503);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, passwordHash, fullName, roleId: userRole.id },
    });

    auditLog(user.id, "USER_REGISTERED", undefined, getClientIpFromRequest(req));

    return apiCreated(
      { userId: user.id },
      "Account created. You can now sign in and set up two-factor authentication."
    );
  } catch (error) {
    console.error("Register error:", error);
    return apiError("Internal server error", 500);
  }
}
