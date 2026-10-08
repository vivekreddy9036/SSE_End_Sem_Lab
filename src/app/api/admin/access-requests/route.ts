import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/utils";
import { getEffectivePermissions } from "@/lib/authz";

/**
 * GET /api/admin/access-requests
 * The approval queue — scoped to resources the caller actually holds
 * APPROVE/MANAGE authority over (middleware already confirmed they hold at
 * least one such permission; this scopes *which* requests they see).
 * ADMIN sees everything, since identity administration spans resources.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const isAdmin = session.roleCode === "ADMIN";

  let resourceIds: number[] | null = null;
  if (!isAdmin) {
    const myPermCodes = await getEffectivePermissions(session.userId);
    const myApprovalPerms = await prisma.permission.findMany({
      where: { code: { in: myPermCodes }, action: { in: ["APPROVE", "MANAGE"] } },
      select: { resourceId: true },
    });
    resourceIds = myApprovalPerms.map((p) => p.resourceId);
  }

  const requests = await prisma.accessRequest.findMany({
    where: resourceIds ? { permission: { resourceId: { in: resourceIds } } } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { fullName: true, email: true } },
      permission: { include: { resource: true } },
      reviewedBy: { select: { fullName: true } },
    },
  });

  return apiSuccess(
    requests.map((r) => ({
      id: r.id,
      status: r.status,
      justification: r.justification,
      requester: r.requester,
      permission: { id: r.permission.id, code: r.permission.code, name: r.permission.name, action: r.permission.action },
      resource: { code: r.permission.resource.code, name: r.permission.resource.name, sensitivity: r.permission.resource.sensitivity },
      reviewedByName: r.reviewedBy?.fullName ?? null,
      reviewNote: r.reviewNote,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
    }))
  );
}
