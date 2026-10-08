import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/utils";

/**
 * GET /api/stages
 * Returns all case stages.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const stages = await prisma.caseStage.findMany({
    orderBy: { id: "asc" },
  });

  return apiSuccess(stages);
}
