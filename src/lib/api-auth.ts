import { NextRequest } from "next/server";
import { getSession, JwtPayload } from "@/lib/auth";
import { apiError } from "@/lib/utils";
import { applyRateLimit, API_RATE_LIMIT, type RateLimitConfig } from "@/lib/rate-limit";

// ── Role hierarchy ──────────────────────────────────
// Higher number = higher privilege
const ROLE_HIERARCHY: Record<string, number> = {
  INS: 1,   // Inspector
  DSP: 2,   // Deputy SP
  ADSP: 3,  // Additional SP
  SP: 4,    // Superintendent
  DIG: 5,   // Deputy Inspector General
};

export type RoleCode = keyof typeof ROLE_HIERARCHY;

/**
 * Extracts and validates the session from cookies.
 * Returns the session payload or a 401 Response.
 * Also applies API-level rate limiting.
 */
export async function requireAuth(
  req: NextRequest,
  rateLimitConfig: RateLimitConfig = API_RATE_LIMIT
): Promise<JwtPayload | Response> {
  // Rate limit check
  const rateLimitResponse = applyRateLimit(req, rateLimitConfig);
  if (rateLimitResponse) return rateLimitResponse;

  const session = await getSession();
  if (!session) {
    return apiError("Unauthorized", 401);
  }
  return session;
}

/**
 * Checks that the session belongs to a supervisory officer (SP or DIG).
 */
export function requireSupervisory(session: JwtPayload): Response | null {
  if (!session.isSupervisory) {
    return apiError("Forbidden — supervisory access required", 403);
  }
  return null;
}

/**
 * Checks that the user has at least the specified role level.
 * e.g. requireMinRole(session, "ADSP") → allows ADSP, SP, DIG
 */
export function requireMinRole(
  session: JwtPayload,
  minRole: RoleCode
): Response | null {
  const userLevel = ROLE_HIERARCHY[session.roleCode] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

  if (userLevel < requiredLevel) {
    return apiError(`Forbidden — requires at least ${minRole} role`, 403);
  }
  return null;
}

/**
 * Checks that the user has one of the specified roles.
 * e.g. requireRole(session, ["SP", "DIG"])
 */
export function requireRole(
  session: JwtPayload,
  allowedRoles: RoleCode[]
): Response | null {
  if (!allowedRoles.includes(session.roleCode as RoleCode)) {
    return apiError(
      `Forbidden — requires one of: ${allowedRoles.join(", ")}`,
      403
    );
  }
  return null;
}

/**
 * Checks that the user belongs to a specific branch, or is supervisory (can see all).
 */
export function requireBranchAccess(
  session: JwtPayload,
  branchId: number
): Response | null {
  if (session.isSupervisory) return null; // supervisory can access any branch
  if (session.branchId !== branchId) {
    return apiError("Forbidden — you do not have access to this branch", 403);
  }
  return null;
}

/**
 * Combination guard: auth + supervisory in one call.
 * Returns session or error Response.
 */
export async function requireSupervisoryAuth(
  req: NextRequest
): Promise<JwtPayload | Response> {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const forbidden = requireSupervisory(session);
  if (forbidden) return forbidden;

  return session;
}
