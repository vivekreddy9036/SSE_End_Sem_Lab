import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/utils";

/**
 * GET /api/users
 * Returns users list (for case assignment dropdowns).
 * Query params: branchId, roleType (case-holder | supervisory)
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  const roleType = searchParams.get("roleType");

  const where: {
    isActive: boolean;
    branchId?: number;
    role?: { isSupervisory: boolean };
  } = { isActive: true };

  if (branchId) where.branchId = parseInt(branchId, 10);

  if (roleType === "case-holder") {
    where.role = { isSupervisory: false };
  } else if (roleType === "supervisory") {
    where.role = { isSupervisory: true };
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      fullName: true,
      role: { select: { code: true, name: true } },
      branch: { select: { id: true, code: true, name: true } },
    },
    orderBy: { fullName: "asc" },
  });

  return apiSuccess(users);
}
