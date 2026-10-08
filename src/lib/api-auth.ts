import { NextRequest } from "next/server";
import { getSession, JwtPayload } from "@/lib/auth";
import { apiError } from "@/lib/utils";
import { applyRateLimit, API_RATE_LIMIT, type RateLimitConfig } from "@/lib/rate-limit";

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
 * Checks that the user has one of the specified role codes.
 * e.g. requireRole(session, ["ADMIN"])
 */
export function requireRole(
  session: JwtPayload,
  allowedRoles: string[]
): Response | null {
  if (!allowedRoles.includes(session.roleCode)) {
    return apiError(
      `Forbidden — requires one of: ${allowedRoles.join(", ")}`,
      403
    );
  }
  return null;
}

/**
 * Combination guard: auth + role in one call.
 * Returns session or error Response.
 */
export async function requireRoleAuth(
  req: NextRequest,
  allowedRoles: string[]
): Promise<JwtPayload | Response> {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const forbidden = requireRole(session, allowedRoles);
  if (forbidden) return forbidden;

  return session;
}
