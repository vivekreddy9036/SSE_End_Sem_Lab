import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// ── Secrets ─────────────────────────────────────────
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-dev-secret"
);

// ── Cookie / Token Config ───────────────────────────
const ACCESS_TOKEN_NAME = "coats_token";
const REFRESH_TOKEN_NAME = "coats_refresh";
const ACCESS_TOKEN_EXPIRY = "15m"; // short-lived
const REFRESH_TOKEN_EXPIRY = "7d"; // long-lived

// ── JWT Payload ─────────────────────────────────────
export interface JwtPayload {
  userId: number;
  username: string;
  fullName: string;
  roleId: number;
  roleCode: string;
  isSupervisory: boolean;
  branchId: number;
  branchCode: string;
}

export interface RefreshPayload {
  userId: number;
  type: "refresh";
}

/** Short-lived token issued after password verification, before OTP */
export interface TwoFactorPendingPayload {
  userId: number;
  type: "2fa_pending";
}

// ── Sign / Verify ───────────────────────────────────

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function signRefreshToken(userId: number): Promise<string> {
  return new SignJWT({ userId, type: "refresh" } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(
  token: string
): Promise<RefreshPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if ((payload as unknown as RefreshPayload).type !== "refresh") return null;
    return payload as unknown as RefreshPayload;
  } catch {
    return null;
  }
}

// ── 2FA Pending Token ───────────────────────────────
// Issued after password check, valid only for OTP verification (5 min)

const TWO_FA_PENDING_EXPIRY = "5m";
const TWO_FA_COOKIE_NAME = "coats_2fa_pending";

export function get2faCookieName(): string {
  return TWO_FA_COOKIE_NAME;
}

export async function sign2faPendingToken(userId: number): Promise<string> {
  return new SignJWT({ userId, type: "2fa_pending" } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TWO_FA_PENDING_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verify2faPendingToken(
  token: string
): Promise<TwoFactorPendingPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if ((payload as unknown as TwoFactorPendingPayload).type !== "2fa_pending")
      return null;
    return payload as unknown as TwoFactorPendingPayload;
  } catch {
    return null;
  }
}

export function build2faPendingCookie(token: string): string {
  const parts = [
    `${TWO_FA_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${5 * 60}`, // 5 minutes
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function buildClear2faPendingCookie(): string {
  return `${TWO_FA_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// ── Session helpers ─────────────────────────────────

export async function getSession(): Promise<JwtPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function getAccessTokenName(): string {
  return ACCESS_TOKEN_NAME;
}

export function getRefreshTokenName(): string {
  return REFRESH_TOKEN_NAME;
}

// ── Cookie helpers ──────────────────────────────────

const isProduction = process.env.NODE_ENV === "production";

export function buildAccessCookie(token: string): string {
  const parts = [
    `${ACCESS_TOKEN_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${15 * 60}`, // 15 minutes
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function buildRefreshCookie(token: string): string {
  const parts = [
    `${REFRESH_TOKEN_NAME}=${token}`,
    "Path=/api/auth/refresh",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${7 * 24 * 3600}`, // 7 days
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearAccessCookie(): string {
  return `${ACCESS_TOKEN_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function buildClearRefreshCookie(): string {
  return `${REFRESH_TOKEN_NAME}=; Path=/api/auth/refresh; HttpOnly; SameSite=Lax; Max-Age=0`;
}
