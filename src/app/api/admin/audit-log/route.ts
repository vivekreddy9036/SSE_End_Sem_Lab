import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiError, paginatedResponse, parsePagination } from "@/lib/utils";

/**
 * GET /api/admin/audit-log
 * Gated at the middleware edge on AUDIT_LOG_READ (ADMIN and AUDITOR roles
 * both hold it by default); re-checked here too since the JWT permission
 * list can be up to 15 minutes stale if it was just revoked.
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  if (!session.permissions.includes("AUDIT_LOG_READ")) {
    return apiError("Forbidden — requires permission AUDIT_LOG_READ", 403);
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { user: { select: { fullName: true, email: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  return paginatedResponse(
    entries.map((e) => ({
      id: e.id,
      action: e.action,
      detail: e.detail,
      ipAddress: e.ipAddress,
      createdAt: e.createdAt,
      userName: e.user.fullName,
      userEmail: e.user.email,
    })),
    total,
    page,
    limit
  );
}
