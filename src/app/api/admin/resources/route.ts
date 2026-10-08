import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAuth } from "@/lib/api-auth";
import { apiSuccess, apiCreated, apiError } from "@/lib/utils";
import { auditLog, getClientIpFromRequest } from "@/lib/audit";

const createSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]+$/).max(50),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).optional(),
  sensitivity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
});

export async function GET(req: NextRequest) {
  const session = await requireRoleAuth(req, ["ADMIN"]);
  if (session instanceof Response) return session;

  const resources = await prisma.resource.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { permissions: true } } },
  });

  return apiSuccess(
    resources.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      sensitivity: r.sensitivity,
      permissionCount: r._count.permissions,
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

  const existing = await prisma.resource.findUnique({ where: { code: parsed.data.code } });
  if (existing) return apiError("A resource with this code already exists", 409);

  const resource = await prisma.resource.create({ data: parsed.data });
  auditLog(session.userId, "PERMISSION_GRANTED", `Resource created: ${resource.code}`, getClientIpFromRequest(req));

  return apiCreated(resource, "Resource created");
}
