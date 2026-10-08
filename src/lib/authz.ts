import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/utils";
import type { JwtPayload } from "@/lib/auth";

/**
 * Compute a user's effective permission codes: role-granted permissions
 * union direct (UserPermission) grants that haven't expired. This is the
 * single source of truth consulted both at login (to populate the JWT) and
 * by every authorization check below — never trust a stale JWT claim for a
 * high-stakes action, always re-check live where it matters (role/permission
 * management, access-request approval).
 */
export async function getEffectivePermissions(userId: number): Promise<string[]> {
  const [roleGrants, directGrants] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: {
          select: { rolePermissions: { select: { permission: { select: { code: true } } } } },
        },
      },
    }),
    prisma.userPermission.findMany({
      where: {
        userId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { permission: { select: { code: true } } },
    }),
  ]);

  const codes = new Set<string>();
  roleGrants?.role.rolePermissions.forEach((rp) => codes.add(rp.permission.code));
  directGrants.forEach((up) => codes.add(up.permission.code));
  return Array.from(codes);
}

/** Checks the JWT-cached permission list. Fine for low-stakes reads. */
export function requirePermission(
  session: JwtPayload,
  permissionCode: string
): Response | null {
  if (!session.permissions.includes(permissionCode)) {
    return apiError(`Forbidden — requires permission ${permissionCode}`, 403);
  }
  return null;
}

export function requireAnyPermission(
  session: JwtPayload,
  permissionCodes: string[]
): Response | null {
  if (!permissionCodes.some((code) => session.permissions.includes(code))) {
    return apiError(
      `Forbidden — requires one of: ${permissionCodes.join(", ")}`,
      403
    );
  }
  return null;
}

/**
 * Privilege-escalation guard for role assignment.
 *
 * This is deliberately NOT just "does the caller have ROLE_MGMT_MANAGE" —
 * that check alone was the Phase 12 "before" vulnerability (see
 * /docs/12-secure-coding). Two extra invariants close the escalation path:
 *   1. A user can never change their own role, even an admin — prevents a
 *      hijacked admin session from entrenching itself against revocation.
 *   2. Only an existing ADMIN may grant the ADMIN role to someone else —
 *      re-checked live against the DB, not the caller's cached JWT role,
 *      so a just-demoted admin can't ride out their old token.
 */
export async function assertCanAssignRole(
  actingUserId: number,
  targetUserId: number,
  targetRoleCode: string
): Promise<Response | null> {
  if (actingUserId === targetUserId) {
    return apiError("Forbidden — you cannot change your own role", 403);
  }

  if (targetRoleCode === "ADMIN") {
    const actingUser = await prisma.user.findUnique({
      where: { id: actingUserId },
      select: { role: { select: { code: true } } },
    });
    if (actingUser?.role.code !== "ADMIN") {
      return apiError("Forbidden — only an existing Administrator may grant the Administrator role", 403);
    }
  }

  return null;
}

/**
 * Approval-authority guard for access requests.
 *
 * Approving a request for permission P requires the approver to currently
 * hold an APPROVE or MANAGE permission scoped to P's own resource — "being
 * an Administrator" is not sufficient on its own, enforcing separation of
 * duties between identity administration and business-resource ownership.
 */
export async function assertCanApprove(
  actingUserId: number,
  permissionId: number
): Promise<Response | null> {
  const permission = await prisma.permission.findUnique({
    where: { id: permissionId },
    select: { resourceId: true },
  });
  if (!permission) return apiError("Permission not found", 404);

  const approverPerms = await getEffectivePermissions(actingUserId);
  const approverPermRows = await prisma.permission.findMany({
    where: { code: { in: approverPerms }, resourceId: permission.resourceId, action: { in: ["APPROVE", "MANAGE"] } },
    select: { id: true },
  });

  if (approverPermRows.length === 0) {
    return apiError(
      "Forbidden — you do not hold approval authority over this resource",
      403
    );
  }
  return null;
}
