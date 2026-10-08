import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoleAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/utils";
import { auditLog, getClientIpFromRequest } from "@/lib/audit";

const bodySchema = z.object({ isActive: z.boolean() });

/**
 * PATCH /api/admin/users/[id]/status
 * Activate or deactivate an account. Deactivated accounts are rejected at
 * login (and the login route doesn't distinguish "deactivated" from "no
 * such account" in its error message, to avoid account enumeration).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireRoleAuth(req, ["ADMIN"]);
  if (session instanceof Response) return session;

  const targetUserId = parseInt((await params).id, 10);
  if (targetUserId === session.userId) {
    return apiError("You cannot deactivate your own account", 403);
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  }

  const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!targetUser) return apiError("User not found", 404);

  await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: parsed.data.isActive },
  });

  const ip = getClientIpFromRequest(req);
  auditLog(
    session.userId,
    parsed.data.isActive ? "ACCOUNT_REACTIVATED" : "ACCOUNT_DEACTIVATED",
    targetUser.email,
    ip
  );

  return apiSuccess(null, parsed.data.isActive ? "Account reactivated" : "Account deactivated");
}
