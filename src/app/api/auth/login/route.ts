import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  signAccessToken,
  signRefreshToken,
  buildAccessCookie,
  buildRefreshCookie,
  sign2faPendingToken,
  build2faPendingCookie,
} from "@/lib/auth";
import { apiSuccess, apiError } from "@/lib/utils";
import { applyRateLimit, LOGIN_RATE_LIMIT } from "@/lib/rate-limit";
import { isAccountLocked } from "@/lib/totp";
import { auditLog, getClientIpFromRequest, resolveLoginLocation } from "@/lib/audit";
import type { LoginRequest } from "@/types";

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

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit: 5 login attempts per 60s per IP ──
    const rateLimited = applyRateLimit(req, LOGIN_RATE_LIMIT);
    if (rateLimited) return rateLimited;

    const body = (await req.json()) as LoginRequest;

    if (!body.username || !body.password) {
      return apiError("Username and password are required");
    }

    if (!body.turnstileToken) {
      return apiError("CAPTCHA verification required", 400);
    }

    const { lat: browserLat, lng: browserLng } = body as { lat?: number; lng?: number };

    const captchaOk = await verifyTurnstile(body.turnstileToken);
    if (!captchaOk) {
      return apiError("CAPTCHA verification failed. Please try again.", 400);
    }

    const user = await prisma.user.findUnique({
      where: { username: body.username.toUpperCase().trim() },
      include: { role: true, branch: true },
    });

    if (!user || !user.isActive) {
      return apiError("Invalid credentials", 401);
    }

    const ip = getClientIpFromRequest(req);

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      auditLog(user.id, "LOGIN_FAILED", "Invalid password", ip);
      return apiError("Invalid credentials", 401);
    }

    // ── 2FA Flow ──────────────────────────────────────
    // Case 1: 2FA enabled (TOTP or Passkey) → require verification before issuing JWT
    if (user.totpEnabled || user.passkeyEnabled) {
      // Check if account is locked due to failed OTP attempts
      if (isAccountLocked(user.totpLockedUntil)) {
        return apiError(
          "Account temporarily locked due to too many failed attempts. Try again later.",
          423
        );
      }

      const pendingToken = await sign2faPendingToken(user.id);

      const response = apiSuccess(
        {
          requires2FA: true,
          totpEnabled: user.totpEnabled,
          passkeyEnabled: user.passkeyEnabled,
        },
        "2FA verification required"
      );
      response.headers.append("Set-Cookie", build2faPendingCookie(pendingToken));
      return response;
    }

    // Case 2: No 2FA set up → force setup before issuing JWT
    if (!user.totpEnabled && !user.passkeyEnabled) {
      const pendingToken = await sign2faPendingToken(user.id);

      const response = apiSuccess(
        { requires2FA: true, totpEnabled: false },
        "2FA setup required"
      );
      response.headers.append("Set-Cookie", build2faPendingCookie(pendingToken));
      return response;
    }

    // ── No 2FA (fallback — should not reach here) ────
    // Update last login
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

    // Set HttpOnly cookies (access + refresh)
    response.headers.append("Set-Cookie", buildAccessCookie(accessToken));
    response.headers.append("Set-Cookie", buildRefreshCookie(refreshToken));

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return apiError("Internal server error", 500);
  }
}
