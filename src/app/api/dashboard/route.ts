import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisoryAuth } from "@/lib/api-auth";
import { apiSuccess, apiError } from "@/lib/utils";

/**
 * GET /api/dashboard
 * Supervisory-only dashboard data.
 * Query params: branchId, dateFrom, dateTo
 */
export async function GET(req: NextRequest) {
  const session = await requireSupervisoryAuth(req);
  if (session instanceof Response) return session;

  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Get all branches with case counts per stage
    const branches = await prisma.branch.findMany({
      include: {
        cases: {
          where: { isActive: true },
          select: {
            stage: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { id: "asc" },
    });

    const stages = await prisma.caseStage.findMany({ orderBy: { id: "asc" } });

    const branchSummaries = branches.map((branch) => {
      const branchCases = (branch as unknown as { cases: { stage: { code: string; name: string } }[] }).cases;
      const stageCounts = stages.map((stage) => ({
        stageCode: stage.code,
        stageName: stage.name,
        count: branchCases.filter((c) => c.stage.code === stage.code).length,
      }));

      return {
        branchId: branch.id,
        branchCode: branch.code,
        branchName: branch.name,
        stages: stageCounts,
        total: branchCases.length,
      };
    });

    const totalCases = branchSummaries.reduce((sum: number, b: { total: number }) => sum + b.total, 0);

    // Monthly case registration trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const trendCases = await prisma.case.findMany({
      where: {
        isActive: true,
        dateOfRegistration: { gte: sixMonthsAgo },
        ...(branchId ? { branchId: parseInt(branchId, 10) } : {}),
      },
      select: {
        dateOfRegistration: true,
        stage: { select: { code: true } },
      },
    });

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyTrend: { month: string; UI: number; PT: number; HC: number; SC: number; total: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const monthCases = trendCases.filter(
        (c) => {
          const regDate = new Date(c.dateOfRegistration);
          return `${regDate.getFullYear()}-${String(regDate.getMonth() + 1).padStart(2, "0")}` === key;
        }
      );
      monthlyTrend.push({
        month: label,
        UI: monthCases.filter((c) => c.stage.code === "UI").length,
        PT: monthCases.filter((c) => c.stage.code === "PT").length,
        HC: monthCases.filter((c) => c.stage.code === "HC").length,
        SC: monthCases.filter((c) => c.stage.code === "SC").length,
        total: monthCases.length,
      });
    }

    // Stage distribution for pie chart
    const stageDistribution = stages.map((stage) => {
      const count = branchSummaries
        .filter((b) => !branchId || b.branchId === parseInt(branchId, 10))
        .reduce((sum, b) => sum + (b.stages.find((s) => s.stageCode === stage.code)?.count || 0), 0);
      return { stage: stage.code, name: stage.name, count };
    });

    // ── Case Age Distribution ──────────────────────
    const branchIdFilter = branchId ? parseInt(branchId, 10) : undefined;
    const activeCases = await prisma.case.findMany({
      where: {
        isActive: true,
        ...(branchIdFilter ? { branchId: branchIdFilter } : {}),
      },
      select: { dateOfRegistration: true },
    });

    const now = new Date();
    const ageBuckets = { "< 30 days": 0, "30–90 days": 0, "90–180 days": 0, "> 180 days": 0 };
    for (const c of activeCases) {
      const days = Math.floor((now.getTime() - new Date(c.dateOfRegistration).getTime()) / 86400000);
      if (days < 30) ageBuckets["< 30 days"]++;
      else if (days < 90) ageBuckets["30–90 days"]++;
      else if (days < 180) ageBuckets["90–180 days"]++;
      else ageBuckets["> 180 days"]++;
    }
    const caseAgeDistribution = Object.entries(ageBuckets).map(([bracket, count]) => ({ bracket, count }));

    // ── Top Sections of Law ────────────────────────
    const sectionCases = await prisma.case.findMany({
      where: {
        isActive: true,
        ...(branchIdFilter ? { branchId: branchIdFilter } : {}),
      },
      select: { sectionOfLaw: true },
    });
    const sectionMap = new Map<string, number>();
    for (const c of sectionCases) {
      const section = c.sectionOfLaw.trim();
      sectionMap.set(section, (sectionMap.get(section) || 0) + 1);
    }
    const topSections = [...sectionMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([section, count]) => ({ section, count }));

    // ── Officer Workload (Top 8) ───────────────────
    const officerCases = await prisma.case.groupBy({
      by: ["assignedOfficerId"],
      where: {
        isActive: true,
        ...(branchIdFilter ? { branchId: branchIdFilter } : {}),
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    });
    const officerIds = officerCases.map((o) => o.assignedOfficerId);
    const officers = await prisma.user.findMany({
      where: { id: { in: officerIds } },
      select: { id: true, fullName: true },
    });
    const officerWorkload = officerCases.map((o) => ({
      officer: officers.find((u) => u.id === o.assignedOfficerId)?.fullName || "Unknown",
      cases: o._count.id,
    }));

    // ── Action Completion Stats ────────────────────
    const actionStats = await prisma.caseAction.aggregate({
      where: {
        case: {
          isActive: true,
          ...(branchIdFilter ? { branchId: branchIdFilter } : {}),
        },
      },
      _count: { id: true },
    });
    const completedActions = await prisma.caseAction.count({
      where: {
        isCompleted: true,
        case: {
          isActive: true,
          ...(branchIdFilter ? { branchId: branchIdFilter } : {}),
        },
      },
    });
    const actionCompletionData = {
      completed: completedActions,
      pending: actionStats._count.id - completedActions,
      total: actionStats._count.id,
    };

    // ── Progress Activity Trend (last 6 months) ────
    const progressActivity = await prisma.caseProgress.findMany({
      where: {
        createdAt: { gte: sixMonthsAgo },
        ...(branchIdFilter ? { case: { branchId: branchIdFilter } } : {}),
      },
      select: { createdAt: true },
    });
    const monthlyProgress: { month: string; entries: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const count = progressActivity.filter(
        (p) => `${p.createdAt.getFullYear()}-${String(p.createdAt.getMonth() + 1).padStart(2, "0")}` === key
      ).length;
      monthlyProgress.push({ month: label, entries: count });
    }

    // Fetch progress entries within date range (if provided)
    let progressEntries = null;
    if (dateFrom && dateTo) {
      const progressWhere: {
        progressDate: { gte: Date; lte: Date };
        case?: { branchId: number };
      } = {
        progressDate: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo),
        },
      };

      if (branchId) {
        progressWhere.case = { branchId: parseInt(branchId, 10) };
      }

      progressEntries = await prisma.caseProgress.findMany({
        where: progressWhere,
        include: {
          case: {
            select: {
              uid: true,
              branch: { select: { name: true } },
              actions: {
                where: { isCompleted: false },
                select: { id: true, description: true },
              },
            },
          },
          createdBy: { select: { fullName: true } },
        },
        orderBy: { progressDate: "desc" },
        take: 100,
      });
    }

    return apiSuccess({
      branches: branchSummaries,
      totalCases,
      monthlyTrend,
      stageDistribution,
      caseAgeDistribution,
      topSections,
      officerWorkload,
      actionCompletion: actionCompletionData,
      monthlyProgress,
      progressEntries,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return apiError("Internal server error", 500);
  }
}
