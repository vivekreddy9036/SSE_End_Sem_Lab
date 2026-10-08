import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { apiSuccess } from "@/lib/utils";

export interface NotificationItem {
  id: string;
  type: "pending_action" | "reminder" | "reassignment";
  severity: "overdue" | "upcoming" | "info";
  title: string;
  message: string;
  link: string;
  createdAt: string;
}

/**
 * GET /api/notifications
 * Computed, read-only notification feed — no dedicated table.
 * Sources: pending case actions, upcoming/overdue progress reminders,
 * and recent case reassignments (from the audit log).
 */
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (session instanceof Response) return session;

  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const scopeToOfficer = !session.isSupervisory;

  const [pendingActions, dueReminders, reassignmentLogs] = await Promise.all([
    prisma.caseAction.findMany({
      where: {
        isCompleted: false,
        ...(scopeToOfficer && { case: { assignedOfficerId: session.userId } }),
      },
      include: { case: { select: { id: true, uid: true } } },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.caseProgress.findMany({
      where: {
        reminderDate: { not: null, lte: weekAhead },
        ...(scopeToOfficer && { case: { assignedOfficerId: session.userId } }),
      },
      include: { case: { select: { id: true, uid: true } } },
      orderBy: { reminderDate: "asc" },
      take: 50,
    }),
    prisma.auditLog.findMany({
      where: { action: "CASE_REASSIGNED", createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const notifications: NotificationItem[] = [];

  for (const a of pendingActions) {
    notifications.push({
      id: `action-${a.id}`,
      type: "pending_action",
      severity: "info",
      title: `Pending action — ${a.case.uid}`,
      message: a.description,
      link: `/cases/${a.case.id}`,
      createdAt: a.createdAt.toISOString(),
    });
  }

  for (const p of dueReminders) {
    if (!p.reminderDate) continue;
    const overdue = p.reminderDate < now;
    notifications.push({
      id: `reminder-${p.id}`,
      type: "reminder",
      severity: overdue ? "overdue" : "upcoming",
      title: `${overdue ? "Overdue" : "Upcoming"} reminder — ${p.case.uid}`,
      message: p.furtherAction || p.progressDetails,
      link: `/cases/${p.case.id}`,
      createdAt: p.reminderDate.toISOString(),
    });
  }

  for (const log of reassignmentLogs) {
    if (!log.detail) continue;
    try {
      const detail = JSON.parse(log.detail) as {
        caseId: number;
        caseUid: string;
        fromOfficerId: number;
        toOfficerId: number;
      };
      if (scopeToOfficer && detail.toOfficerId !== session.userId) continue;
      notifications.push({
        id: `reassign-${log.id}`,
        type: "reassignment",
        severity: "info",
        title: `Case reassigned — ${detail.caseUid}`,
        message: "This case was assigned to you.",
        link: `/cases/${detail.caseId}`,
        createdAt: log.createdAt.toISOString(),
      });
    } catch {
      // malformed detail — skip
    }
  }

  const severityRank: Record<NotificationItem["severity"], number> = {
    overdue: 0,
    upcoming: 1,
    info: 2,
  };

  notifications.sort((a, b) => {
    const rankDiff = severityRank[a.severity] - severityRank[b.severity];
    if (rankDiff !== 0) return rankDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return apiSuccess(notifications);
}
