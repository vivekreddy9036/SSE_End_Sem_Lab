import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/utils";
import { assertCanApprove } from "@/lib/authz";
import { auditLog, getClientIpFromRequest } from "@/lib/audit";

const bodySchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().trim().max(2000).optional(),
  expiresInMinutes: z.number().int().positive().optional(),
});

/**
 * POST /api/admin/access-requests/[id]/review
 *
 * This is where assertCanApprove actually runs (middleware only checked the
 * caller holds *some* APPROVE/MANAGE permission; this verifies it's for
 * *this specific request's* resource) — approving grants a UserPermission,
 * which is the one place in the app a privilege actually gets created.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const requestId = parseInt((await params).id, 10);
  const accessRequest = await prisma.accessRequest.findUnique({
    where: { id: requestId },
    include: { permission: true },
  });
  if (!accessRequest) return apiError("Access request not found", 404);
  if (accessRequest.status !== "PENDING") {
    return apiError("This request has already been reviewed", 409);
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const ip = getClientIpFromRequest(req);

  // A user who already holds APPROVE/MANAGE on a resource (e.g. for one
  // permission) must not be able to request a *different* permission on
  // that same resource and then approve their own request — self-approval
  // is blocked unconditionally, before the resource-ownership check below.
  if (accessRequest.requesterId === session.userId) {
    auditLog(session.userId, "ACCESS_APPROVAL_BLOCKED", `Request #${requestId} (self-approval attempt)`, ip);
    return apiError("Forbidden — you cannot review your own access request", 403);
  }

  // ADMIN bypasses the resource-ownership check (identity admin spans
  // resources), everyone else must hold APPROVE/MANAGE on this permission's
  // specific resource — re-checked live, not from the (possibly stale) JWT.
  if (session.roleCode !== "ADMIN") {
    const blocked = await assertCanApprove(session.userId, accessRequest.permissionId);
    if (blocked) {
      auditLog(session.userId, "ACCESS_APPROVAL_BLOCKED", `Request #${requestId}`, ip);
      return blocked;
    }
  }

  const { decision, reviewNote, expiresInMinutes } = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.accessRequest.update({
      where: { id: requestId },
      data: {
        status: decision,
        reviewedById: session.userId,
        reviewedAt: new Date(),
        reviewNote: reviewNote ?? null,
      },
    });

    if (decision === "APPROVED") {
      await tx.userPermission.upsert({
        where: { userId_permissionId: { userId: accessRequest.requesterId, permissionId: accessRequest.permissionId } },
        update: {
          grantedById: session.userId,
          grantedAt: new Date(),
          expiresAt: expiresInMinutes ? new Date(Date.now() + expiresInMinutes * 60_000) : null,
          sourceAccessRequestId: requestId,
        },
        create: {
          userId: accessRequest.requesterId,
          permissionId: accessRequest.permissionId,
          grantedById: session.userId,
          expiresAt: expiresInMinutes ? new Date(Date.now() + expiresInMinutes * 60_000) : null,
          sourceAccessRequestId: requestId,
        },
      });
    }
  });

  auditLog(
    session.userId,
    decision === "APPROVED" ? "ACCESS_APPROVED" : "ACCESS_REJECTED",
    `Request #${requestId} (${accessRequest.permission.code}) for user #${accessRequest.requesterId}`,
    ip
  );

  return apiSuccess(null, decision === "APPROVED" ? "Access request approved" : "Access request rejected");
}
