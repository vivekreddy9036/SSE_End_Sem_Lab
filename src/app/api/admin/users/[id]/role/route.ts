import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/utils";
import { assertCanAssignRole } from "@/lib/authz";
import { auditLog, getClientIpFromRequest } from "@/lib/audit";

const bodySchema = z.object({ roleId: z.number().int().positive() });

/**
 * PATCH /api/admin/users/[id]/role
 *
 * See src/lib/authz.ts assertCanAssignRole for why this is more than a
 * single role check — this is the exact endpoint the Phase 12 "before"
 * privilege-escalation vulnerability lived in.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireRoleAuth(req, ["ADMIN"]);
  if (session instanceof Response) return session;

  const targetUserId = parseInt((await params).id, 10);
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) return apiError("User not found", 404);

  const newRole = await prisma.role.findUnique({ where: { id: parsed.data.roleId } });
  if (!newRole) return apiError("Role not found", 404);

  const ip = getClientIpFromRequest(req);

  const blocked = await assertCanAssignRole(session.userId, targetUserId, newRole.code);
  if (blocked) {
    auditLog(session.userId, "ROLE_ASSIGNMENT_BLOCKED", `Attempted to set ${targetUser.email} -> ${newRole.code}`, ip);
    return blocked;
  }

  await prisma.user.update({ where: { id: targetUserId }, data: { roleId: newRole.id } });
  auditLog(session.userId, "ROLE_ASSIGNED", `${targetUser.email} -> ${newRole.code}`, ip);

  return apiSuccess(null, "Role updated");
}
