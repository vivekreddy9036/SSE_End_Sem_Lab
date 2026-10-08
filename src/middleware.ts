import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-dev-secret"
);

const ACCESS_TOKEN_NAME = "sentineliam_token";

// ── Route definitions ───────────────────────────────
// Public routes — no auth required
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/2fa/setup",
  "/api/auth/2fa/verify-setup",
  "/api/auth/2fa/verify",
  "/api/auth/passkey/register-options",
  "/api/auth/passkey/register-verify",
  "/api/auth/passkey/auth-options",
  "/api/auth/passkey/auth-verify",
  "/two-factor",
];

// Identity-structure admin routes: only ADMIN manages users/roles/permissions/
// resources themselves (separate from being able to use what they grant).
const ADMIN_ONLY_PREFIXES = [
  "/admin/users",
  "/api/admin/users",
  "/admin/roles",
  "/api/admin/roles",
  "/admin/permissions",
  "/api/admin/permissions",
  "/admin/resources",
  "/api/admin/resources",
];

// Approval queue: anyone holding an APPROVE/MANAGE permission on at least one
// resource, not just Administrators — separation of duties between identity
// administration and business-resource ownership. This is a coarse edge
// check against the JWT's cached permission list; the actual per-request
// approval still gets re-verified live against the DB in the route handler
// (src/lib/authz.ts assertCanApprove) since the JWT can be up to 15m stale.
const APPROVAL_PREFIXES = ["/admin/access-requests", "/api/admin/access-requests"];

// Audit log: ADMIN and AUDITOR roles both hold AUDIT_LOG_READ by default.
const AUDIT_PREFIXES = ["/admin/audit-log", "/api/admin/audit-log"];

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
  let payload: { userId?: number; roleCode?: string; permissions?: string[] };
  try {
    const { payload: verified } = await jwtVerify(token, JWT_SECRET);
    payload = verified as typeof payload;
  } catch {
    // Token expired or invalid — try refresh for page routes
    return handleUnauthorized(req, pathname);
  }

  // 5. RBAC: edge-level gates (route handlers re-verify against the DB)
  const permissions = payload.permissions ?? [];
  const isForbidden =
    (ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p)) && payload.roleCode !== "ADMIN") ||
    (APPROVAL_PREFIXES.some((p) => pathname.startsWith(p)) &&
      !permissions.some((code) => code.endsWith("_APPROVE") || code.endsWith("_MANAGE"))) ||
    (AUDIT_PREFIXES.some((p) => pathname.startsWith(p)) && !permissions.includes("AUDIT_LOG_READ"));

  if (isForbidden) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 6. Add user info to request headers (available to API routes)
  const response = NextResponse.next();
  response.headers.set("x-user-id", String(payload.userId || ""));
  response.headers.set("x-user-role", payload.roleCode || "");

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
