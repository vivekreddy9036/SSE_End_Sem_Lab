import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess, apiCreated, apiError } from "@/lib/utils";
import { auditLog, getClientIpFromRequest } from "@/lib/audit";

const createSchema = z.object({
  permissionId: z.number().int().positive(),
  justification: z.string().trim().min(10).max(2000),
});

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const requests = await prisma.accessRequest.findMany({
    where: { requesterId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      permission: { include: { resource: true } },
      reviewedBy: { select: { fullName: true } },
    },
  });

  return apiSuccess(
    requests.map((r) => ({
      id: r.id,
      status: r.status,
      justification: r.justification,
      permission: { code: r.permission.code, name: r.permission.name, action: r.permission.action },
      resource: { code: r.permission.resource.code, name: r.permission.resource.name },
      reviewedByName: r.reviewedBy?.fullName ?? null,
      reviewNote: r.reviewNote,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
    }))
  );
}

/**
 * POST /api/access-requests
 * Any authenticated user can request any permission — there is no
 * self-escalation risk here because requesting grants nothing; it only
 * creates a PENDING row that an authorized approver must act on via
 * /api/admin/access-requests/[id]/review (which re-checks approval
 * authority live, see assertCanApprove).
 */
export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const permission = await prisma.permission.findUnique({ where: { id: parsed.data.permissionId } });
  if (!permission) return apiError("Permission not found", 404);

  const existingPending = await prisma.accessRequest.findFirst({
    where: { requesterId: session.userId, permissionId: permission.id, status: "PENDING" },
  });
  if (existingPending) {
    return apiError("You already have a pending request for this permission", 409);
  }

  const request = await prisma.accessRequest.create({
    data: {
      requesterId: session.userId,
      permissionId: permission.id,
      justification: parsed.data.justification,
    },
  });

  auditLog(session.userId, "ACCESS_REQUESTED", permission.code, getClientIpFromRequest(req));

  return apiCreated(request, "Access request submitted");
}
