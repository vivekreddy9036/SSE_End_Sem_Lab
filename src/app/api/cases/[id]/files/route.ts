import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess, apiError, apiCreated } from "@/lib/utils";
import {
  uploadFile,
  deleteFile,
  getDownloadUrl,
  isAllowedFileType,
  STORAGE_CAP_BYTES,
  MAX_FILE_SIZE,
  formatBytes,
} from "@/lib/r2";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ── GET /api/cases/[id]/files  — list files for a case ──────────────────────

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const { id } = await params;
  const caseId = parseInt(id, 10);

  // Verify case exists and user has access
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, assignedOfficerId: true },
  });

  if (!caseData) return apiError("Case not found", 404);
  if (!session.isSupervisory && caseData.assignedOfficerId !== session.userId) {
    return apiError("Forbidden", 403);
  }

  const files = await prisma.caseFile.findMany({
    where: { caseId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { fullName: true } } },
  });

  // Get total storage used (from DB — fast aggregate)
  const storageAgg = await prisma.caseFile.aggregate({
    _sum: { sizeBytes: true },
  });
  const totalUsed = storageAgg._sum.sizeBytes ?? 0;

  return apiSuccess({
    files,
    storage: {
      used: totalUsed,
      cap: STORAGE_CAP_BYTES,
      usedFormatted: formatBytes(totalUsed),
      capFormatted: formatBytes(STORAGE_CAP_BYTES),
      remainingFormatted: formatBytes(STORAGE_CAP_BYTES - totalUsed),
    },
  });
}

// ── POST /api/cases/[id]/files  — upload a file ────────────────────────────

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const { id } = await params;
  const caseId = parseInt(id, 10);

  // Verify case exists and user has access
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, assignedOfficerId: true },
  });

  if (!caseData) return apiError("Case not found", 404);
  if (!session.isSupervisory && caseData.assignedOfficerId !== session.userId) {
    return apiError("Forbidden", 403);
  }

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return apiError("No file provided", 400);

  // ── Validate file type ──────────────────────────────────────────────────
  if (!isAllowedFileType(file.type)) {
    return apiError(
      "File type not allowed. Accepted: PDF, images, DOC, DOCX, XLS, XLSX, TXT, MP3/WAV/M4A/OGG, MP4/WEBM/MOV",
      400
    );
  }

  // ── Validate file size ──────────────────────────────────────────────────
  if (file.size > MAX_FILE_SIZE) {
    return apiError(`File too large. Maximum size is ${formatBytes(MAX_FILE_SIZE)}`, 400);
  }

  // ── Check global storage quota BEFORE uploading ─────────────────────────
  const storageAgg = await prisma.caseFile.aggregate({
    _sum: { sizeBytes: true },
  });
  const currentUsed = storageAgg._sum.sizeBytes ?? 0;

  if (currentUsed + file.size > STORAGE_CAP_BYTES) {
    const remaining = STORAGE_CAP_BYTES - currentUsed;
    return apiError(
      `Storage quota exceeded. Only ${formatBytes(remaining)} remaining out of ${formatBytes(STORAGE_CAP_BYTES)}. This file is ${formatBytes(file.size)}.`,
      413
    );
  }

  // ── Upload to R2 ────────────────────────────────────────────────────────
  const buffer = Buffer.from(await file.arrayBuffer());
  const { key, size } = await uploadFile(caseId, file.name, buffer, file.type);

  // ── Record in DB ────────────────────────────────────────────────────────
  const record = await prisma.caseFile.create({
    data: {
      caseId,
      r2Key: key,
      fileName: file.name,
      contentType: file.type,
      sizeBytes: size,
      uploadedById: session.userId,
    },
    include: { uploadedBy: { select: { fullName: true } } },
  });

  return apiCreated(record, "File uploaded successfully");
}

// ── DELETE /api/cases/[id]/files?fileId=123  — delete a file ────────────────

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const { id } = await params;
  const caseId = parseInt(id, 10);
  const fileId = parseInt(req.nextUrl.searchParams.get("fileId") ?? "", 10);

  if (isNaN(fileId)) return apiError("fileId is required", 400);

  // Verify the file belongs to this case
  const fileRecord = await prisma.caseFile.findFirst({
    where: { id: fileId, caseId },
  });

  if (!fileRecord) return apiError("File not found", 404);

  // Only uploader or supervisory can delete
  if (!session.isSupervisory && fileRecord.uploadedById !== session.userId) {
    return apiError("Forbidden", 403);
  }

  // Delete from R2 first, then DB
  await deleteFile(fileRecord.r2Key);
  await prisma.caseFile.delete({ where: { id: fileId } });

  return apiSuccess(null, "File deleted successfully");
}
