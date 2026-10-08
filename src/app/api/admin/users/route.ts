import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleAuth } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await requireRoleAuth(req, ["ADMIN"]);
  if (session instanceof Response) return session;

  const users = await prisma.user.findMany({
    orderBy: { fullName: "asc" },
    include: { role: { select: { id: true, code: true, name: true } } },
  });

  return apiSuccess(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      isActive: u.isActive,
      lockedUntil: u.lockedUntil,
      role: u.role,
      totpEnabled: u.totpEnabled,
      passkeyEnabled: u.passkeyEnabled,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt,
    }))
  );
}
