import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  if (session.roleCode === "ADMIN") {
    const [totalUsers, activeUsers, lockedUsers, totalRoles, totalResources, totalPermissions, pendingRequests, usersByRole, recentAudit] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { lockedUntil: { gt: new Date() } } }),
        prisma.role.count(),
        prisma.resource.count(),
        prisma.permission.count(),
        prisma.accessRequest.count({ where: { status: "PENDING" } }),
        prisma.role.findMany({
          select: { code: true, name: true, _count: { select: { users: true } } },
          orderBy: { code: "asc" },
        }),
        prisma.auditLog.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: { user: { select: { fullName: true, email: true } } },
        }),
      ]);

    return apiSuccess({
      scope: "admin" as const,
      totalUsers,
      activeUsers,
      lockedUsers,
      totalRoles,
      totalResources,
      totalPermissions,
      pendingRequests,
      usersByRole: usersByRole.map((r) => ({ roleCode: r.code, roleName: r.name, count: r._count.users })),
      recentAudit: recentAudit.map((a) => ({
        id: a.id,
        action: a.action,
        detail: a.detail,
        userName: a.user.fullName,
        userEmail: a.user.email,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  }

  // Non-admin: personal summary only.
  const [myRequests] = await Promise.all([
    prisma.accessRequest.findMany({
      where: { requesterId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { permission: { include: { resource: true } } },
    }),
  ]);

  return apiSuccess({
    scope: "personal" as const,
    roleCode: session.roleCode,
    permissions: session.permissions,
    myRequests: myRequests.map((r) => ({
      id: r.id,
      status: r.status,
      permissionName: r.permission.name,
      resourceName: r.permission.resource.name,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
