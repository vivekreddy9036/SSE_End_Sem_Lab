import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiCreated, apiSuccess, apiError, parsePagination, paginatedResponse } from "@/lib/utils";
import { fabricRecordProgress } from "@/lib/fabric";
import type { CreateProgressRequest } from "@/types";


interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/cases/[id]/progress
 * List progress entries for a case.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const { id } = await params;
  const caseId = parseInt(id, 10);

  const caseData = await prisma.case.findUnique({ where: { id: caseId } });
  if (!caseData) return apiError("Case not found", 404);

  if (!session.isSupervisory && caseData.assignedOfficerId !== session.userId) {
    return apiError("Forbidden", 403);
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);

  const [entries, total] = await Promise.all([
    prisma.caseProgress.findMany({
      where: { caseId },
      include: {
        createdBy: { select: { fullName: true } },
      },
      orderBy: { progressDate: "desc" },
      skip,
      take: limit,
    }),
    prisma.caseProgress.count({ where: { caseId } }),
  ]);

  return paginatedResponse(entries, total, page, limit);
}

/**
 * POST /api/cases/[id]/progress
 * Add progress entry. Optionally mark actions as completed and create new action from furtherAction.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const { id } = await params;
  const caseId = parseInt(id, 10);

  const caseData = await prisma.case.findUnique({ where: { id: caseId } });
  if (!caseData) return apiError("Case not found", 404);

  if (!session.isSupervisory && caseData.assignedOfficerId !== session.userId) {
    return apiError("Forbidden", 403);
  }

  const body = (await req.json()) as CreateProgressRequest;

  if (!body.progressDate || !body.progressDetails) {
    return apiError("progressDate and progressDetails are required");
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the progress entry
    const progress = await tx.caseProgress.create({
      data: {
        caseId,
        progressDate: new Date(body.progressDate),
        progressDetails: body.progressDetails,
        reminderDate: body.reminderDate ? new Date(body.reminderDate) : null,
        furtherAction: body.furtherAction || null,
        remarks: body.remarks || null,
        createdById: session.userId,
      },
    });

    // 2. Mark checked actions as completed
    if (body.completedActionIds && body.completedActionIds.length > 0) {
      await tx.caseAction.updateMany({
        where: {
          id: { in: body.completedActionIds },
          caseId,
          isCompleted: false,
        },
        data: {
          isCompleted: true,
          completedAt: new Date(),
        },
      });
    }

    // 3. If furtherAction is provided, create it as a new action item
    if (body.furtherAction && body.furtherAction.trim()) {
      await tx.caseAction.create({
        data: {
          caseId,
          description: body.furtherAction.trim(),
          createdById: session.userId,
        },
      });
    }

    return progress;
  });

  // Anchor progress entry on Hyperledger Fabric ledger (fire-and-forget)
  fabricRecordProgress(
    caseData.uid,
    session.userId,
    body.progressDate,
    result.id
  );

  return apiCreated(result, "Progress added");
}
