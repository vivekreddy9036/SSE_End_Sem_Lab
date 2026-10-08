import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/utils";

/**
 * GET /api/branches
 * Returns all branches.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const branches = await prisma.branch.findMany({
    orderBy: { id: "asc" },
  });

  return apiSuccess(branches);
}
