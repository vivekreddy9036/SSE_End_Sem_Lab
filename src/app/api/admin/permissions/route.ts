import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAuth } from "@/lib/api-auth";
import { apiSuccess, apiCreated, apiError } from "@/lib/utils";
import { auditLog, getClientIpFromRequest } from "@/lib/audit";

const createSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]+$/).max(50),
  name: z.string().trim().min(1).max(150),
  action: z.enum(["READ", "WRITE", "APPROVE", "MANAGE", "ADMIN"]),
  resourceId: z.number().int().positive(),
});

export async function GET(req: NextRequest) {
  const session = await requireRoleAuth(req, ["ADMIN"]);
  if (session instanceof Response) return session;

  const permissions = await prisma.permission.findMany({
    orderBy: [{ resourceId: "asc" }, { action: "asc" }],
    include: { resource: { select: { id: true, code: true, name: true } } },
  });

  return apiSuccess(
    permissions.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      action: p.action,
      resource: p.resource,
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

  const resource = await prisma.resource.findUnique({ where: { id: parsed.data.resourceId } });
  if (!resource) return apiError("Resource not found", 404);

  const existing = await prisma.permission.findUnique({ where: { code: parsed.data.code } });
  if (existing) return apiError("A permission with this code already exists", 409);

  const permission = await prisma.permission.create({ data: parsed.data });
  auditLog(session.userId, "PERMISSION_GRANTED", `Permission created: ${permission.code}`, getClientIpFromRequest(req));

  return apiCreated(permission, "Permission created");
}
