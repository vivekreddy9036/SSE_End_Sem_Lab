import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-dev-secret"
);

const ACCESS_TOKEN_NAME = "coats_token";

// ── Route definitions ───────────────────────────────
// Public routes — no auth required
const PUBLIC_ROUTES = [
  "/login",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/2fa/setup",
  "/api/auth/2fa/verify-setup",
  "/api/auth/2fa/verify",
  "/api/auth/passkey/register-options",
  "/api/auth/passkey/register-verify",
  "/api/auth/passkey/auth-options",
  "/api/auth/passkey/auth-verify",
  "/two-factor",
];

// Supervisory-only page routes
const SUPERVISORY_PAGES = ["/all-cases", "/dashboard"];

// Supervisory-only API routes
const SUPERVISORY_API_PREFIXES = ["/api/dashboard"];

// ── Middleware ───────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Skip public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // 2. Skip static assets & Next internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 3. Check for access token
  const token = req.cookies.get(ACCESS_TOKEN_NAME)?.value;

  if (!token) {
    return handleUnauthorized(req, pathname);
  }

  // 4. Verify access token (Edge-compatible jose)
  let payload: { userId?: number; isSupervisory?: boolean; roleCode?: string; branchId?: number };
  try {
    const { payload: verified } = await jwtVerify(token, JWT_SECRET);
    payload = verified as typeof payload;
  } catch {
    // Token expired or invalid — try refresh for page routes
    return handleUnauthorized(req, pathname);
  }

  // 5. RBAC: Supervisory page access
  if (SUPERVISORY_PAGES.some((p) => pathname.startsWith(p))) {
    if (!payload.isSupervisory) {
      // Redirect non-supervisory users to their cases page
      return NextResponse.redirect(new URL("/cases", req.url));
    }
  }

  // 6. RBAC: Supervisory API access
  if (SUPERVISORY_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!payload.isSupervisory) {
      return NextResponse.json(
        { success: false, message: "Forbidden — supervisory access required" },
        { status: 403 }
      );
    }
  }

  // 7. Add user info to request headers (available to API routes)
  const response = NextResponse.next();
  response.headers.set("x-user-id", String(payload.userId || ""));
  response.headers.set("x-user-role", payload.roleCode || "");
  response.headers.set("x-user-branch", String(payload.branchId || ""));
  response.headers.set("x-user-supervisory", payload.isSupervisory ? "true" : "false");

  return response;
}

// ── Helpers ─────────────────────────────────────────

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route + "/"));
}

function handleUnauthorized(req: NextRequest, pathname: string): NextResponse {
  // API routes → 401 JSON
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }
  // Page routes → redirect to login
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

// ── Matcher config ──────────────────────────────────
// Run middleware on all routes except static files
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
