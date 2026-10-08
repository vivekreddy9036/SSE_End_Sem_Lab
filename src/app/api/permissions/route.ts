import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/utils";

/**
 * GET /api/permissions
 * Read-only catalog of permissions/resources available to request access
 * to. Unlike /api/admin/permissions (ADMIN-only, used to define the
 * catalog), this is open to any authenticated user — browsing what exists
 * isn't sensitive, only being granted it is.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const permissions = await prisma.permission.findMany({
    orderBy: [{ resourceId: "asc" }, { action: "asc" }],
    include: { resource: { select: { code: true, name: true, sensitivity: true } } },
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
