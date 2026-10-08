import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/utils";
import { auditLog, getClientIpFromRequest } from "@/lib/audit";

const bodySchema = z.object({
  permissionId: z.number().int().positive(),
  grant: z.boolean(),
});

/** GET: every permission in the system, flagged with whether this role holds it. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireRoleAuth(req, ["ADMIN"]);
  if (session instanceof Response) return session;

  const roleId = parseInt((await params).id, 10);
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return apiError("Role not found", 404);

  const [allPermissions, granted] = await Promise.all([
    prisma.permission.findMany({
      orderBy: [{ resourceId: "asc" }, { action: "asc" }],
      include: { resource: { select: { code: true, name: true } } },
    }),
    prisma.rolePermission.findMany({ where: { roleId }, select: { permissionId: true } }),
  ]);
  const grantedIds = new Set(granted.map((g) => g.permissionId));

  return apiSuccess(
    allPermissions.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      action: p.action,
      resource: p.resource,
      granted: grantedIds.has(p.id),
    }))
  );
}

/**
 * POST: grant or revoke a single permission for this role. This is the
 * "Administrators define Role -> Permission -> Resource" operation the
 * problem statement asks for, so it's deliberately ADMIN-only (checked by
 * requireRoleAuth) — unlike individual access requests, this changes the
 * baseline for every user holding the role, not just one account.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireRoleAuth(req, ["ADMIN"]);
  if (session instanceof Response) return session;

  const roleId = parseInt((await params).id, 10);
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return apiError("Role not found", 404);

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }
  const { permissionId, grant } = parsed.data;

  const permission = await prisma.permission.findUnique({ where: { id: permissionId } });
  if (!permission) return apiError("Permission not found", 404);

  const ip = getClientIpFromRequest(req);

  if (grant) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId, grantedById: session.userId },
    });
    auditLog(session.userId, "PERMISSION_GRANTED", `${permission.code} -> role ${role.code}`, ip);
  } else {
    await prisma.rolePermission.deleteMany({ where: { roleId, permissionId } });
    auditLog(session.userId, "PERMISSION_REVOKED", `${permission.code} -> role ${role.code}`, ip);
  }

  return apiSuccess(null, grant ? "Permission granted" : "Permission revoked");
}
