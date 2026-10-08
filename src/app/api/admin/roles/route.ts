import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAuth } from "@/lib/api-auth";
import { apiSuccess, apiCreated, apiError } from "@/lib/utils";
import { auditLog, getClientIpFromRequest } from "@/lib/audit";

const createSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]+$/).max(20),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
});

export async function GET(req: NextRequest) {
  const session = await requireRoleAuth(req, ["ADMIN"]);
  if (session instanceof Response) return session;

  const roles = await prisma.role.findMany({
    orderBy: { code: "asc" },
    include: {
      _count: { select: { users: true, rolePermissions: true } },
    },
  });

  return apiSuccess(
    roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissionCount: r._count.rolePermissions,
    }))
  );
}

export async function POST(req: NextRequest) {
  const session = await requireRoleAuth(req, ["ADMIN"]);
  if (session instanceof Response) return session;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const existing = await prisma.role.findUnique({ where: { code: parsed.data.code } });
  if (existing) return apiError("A role with this code already exists", 409);

  const role = await prisma.role.create({ data: parsed.data });
  auditLog(session.userId, "ROLE_ASSIGNED", `Role created: ${role.code}`, getClientIpFromRequest(req));

  return apiCreated(role, "Role created");
}
