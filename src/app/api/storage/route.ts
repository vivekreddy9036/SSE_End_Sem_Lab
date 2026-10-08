import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/utils";
import { STORAGE_CAP_BYTES, formatBytes } from "@/lib/r2";

// ── GET /api/storage — global storage quota info (supervisory only visible) ─

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const storageAgg = await prisma.caseFile.aggregate({
    _sum: { sizeBytes: true },
    _count: true,
  });

  const totalUsed = storageAgg._sum.sizeBytes ?? 0;
  const fileCount = storageAgg._count;

  // Per-case breakdown
  const perCase = await prisma.caseFile.groupBy({
    by: ["caseId"],
    _sum: { sizeBytes: true },
    _count: true,
    orderBy: { _sum: { sizeBytes: "desc" } },
    take: 20,
  });

  return apiSuccess({
    used: totalUsed,
    cap: STORAGE_CAP_BYTES,
    remaining: STORAGE_CAP_BYTES - totalUsed,
    usedFormatted: formatBytes(totalUsed),
    capFormatted: formatBytes(STORAGE_CAP_BYTES),
    remainingFormatted: formatBytes(STORAGE_CAP_BYTES - totalUsed),
    percentUsed: Math.round((totalUsed / STORAGE_CAP_BYTES) * 10000) / 100,
    fileCount,
    topCases: perCase.map((c) => ({
      caseId: c.caseId,
      totalSize: c._sum.sizeBytes ?? 0,
      totalSizeFormatted: formatBytes(c._sum.sizeBytes ?? 0),
      fileCount: c._count,
    })),
  });
}
