import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/utils";
import { getDownloadUrl } from "@/lib/r2";

interface RouteParams {
  params: Promise<{ id: string; fileId: string }>;
}

// ── GET /api/cases/[id]/files/[fileId]/download — get presigned download URL ─

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const { id, fileId } = await params;
  const caseId = parseInt(id, 10);
  const fid = parseInt(fileId, 10);

  // Verify case access
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, assignedOfficerId: true },
  });

  if (!caseData) return apiError("Case not found", 404);
  if (!session.isSupervisory && caseData.assignedOfficerId !== session.userId) {
    return apiError("Forbidden", 403);
  }

  // Find the file record
  const fileRecord = await prisma.caseFile.findFirst({
    where: { id: fid, caseId },
  });

  if (!fileRecord) return apiError("File not found", 404);

  const url = await getDownloadUrl(fileRecord.r2Key);

  return apiSuccess({ url, fileName: fileRecord.fileName });
}
