import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/utils";
import {
  isFabricEnabled,
  fabricGetCaseRecord,
  fabricGetCaseHistory,
  fabricGetStageHistory,
  fabricGetProgressHistory,
} from "@/lib/fabric";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/blockchain/[uid]
 *
 * Returns the full blockchain audit trail for a case.
 * Queries the Hyperledger Fabric ledger for:
 *   - Case creation record + history
 *   - Stage change records
 *   - Progress records
 *
 * Only accessible to authenticated users with access to the case.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  if (!isFabricEnabled()) {
    return apiError("Blockchain integration is not configured", 503);
  }

  const { uid } = await params;

  if (!uid || typeof uid !== "string") {
    return apiError("Invalid case UID", 400);
  }

  // Verify the case exists and user has access
  const caseRecord = await prisma.case.findFirst({
    where: {
      uid,
      isActive: true,
      ...(session.isSupervisory ? {} : { assignedOfficerId: session.userId }),
    },
    select: { id: true, uid: true },
  });

  if (!caseRecord) {
    return apiError("Case not found or access denied", 404);
  }

  try {
    const [creation, history, stages, progress] = await Promise.all([
      fabricGetCaseRecord(uid).catch(() => null),
      fabricGetCaseHistory(uid).catch(() => []),
      fabricGetStageHistory(uid).catch(() => []),
      fabricGetProgressHistory(uid).catch(() => []),
    ]);

    return apiSuccess({
      caseUid: uid,
      fabricEnabled: true,
      creation,
      history,
      stages,
      progress,
    });
  } catch (err) {
    console.error(`[Blockchain API] Query failed for ${uid}:`, err);
    return apiError("Failed to query blockchain ledger", 502);
  }
}
