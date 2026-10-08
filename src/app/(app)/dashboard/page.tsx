"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState, useCallback, useMemo } from "react";
import StageBadge from "@/components/ui/StageBadge";
import { SkeletonPageHeader, SkeletonKpiRow, SkeletonChartCard } from "@/components/ui/skeletons";
import Link from "next/link";
import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { STAGE_COLORS, PIE_FILLS, AGE_COLORS, BRANCH_COLORS } from "@/lib/chart-colors";
import { Printer } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
  Area,
  AreaChart,
  Line,
  LineChart,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  Label,
} from "recharts";

interface StageSummary {
  stageCode: string;
  stageName: string;
  count: number;
}

interface BranchSummary {
  branchId: number;
  branchCode: string;
  branchName: string;
  stages: StageSummary[];
  total: number;
}

interface MonthlyTrend {
  month: string;
  UI: number;
  PT: number;
  HC: number;
  SC: number;
  total: number;
}

interface StageDistribution {
  stage: string;
  name: string;
  count: number;
}

interface CaseAgeBucket {
  bracket: string;
  count: number;
}

interface SectionCount {
  section: string;
  count: number;
}

interface OfficerWorkload {
  officer: string;
  cases: number;
}

interface ActionCompletion {
  completed: number;
  pending: number;
  total: number;
}

interface MonthlyProgress {
  month: string;
  entries: number;
}

interface ProgressEntry {
  id: number;
  progressDate: string;
  progressDetails: string;
  furtherAction: string | null;
  remarks: string | null;
  case: {
    uid: string;
    branch: { name: string };
    actions: { id: number; description: string }[];
  };
  createdBy: { fullName: string };
}

interface DashboardData {
  branches: BranchSummary[];
  totalCases: number;
  monthlyTrend: MonthlyTrend[];
  stageDistribution: StageDistribution[];
  caseAgeDistribution: CaseAgeBucket[];
  topSections: SectionCount[];
  officerWorkload: OfficerWorkload[];
  actionCompletion: ActionCompletion;
  monthlyProgress: MonthlyProgress[];
  progressEntries: ProgressEntry[] | null;
}

// ─── Chart Configs ─────────────────────────────────

const stageChartConfig = {
  UI: { label: "Under Investigation", color: STAGE_COLORS.UI },
  PT: { label: "Pending Trial", color: STAGE_COLORS.PT },
  HC: { label: "High Court", color: STAGE_COLORS.HC },
  SC: { label: "Supreme Court", color: STAGE_COLORS.SC },
  total: { label: "Total Cases", color: "hsl(220, 15%, 50%)" },
} satisfies ChartConfig;

const ageChartConfig = {
  "< 30 days": { label: "< 30 days", color: AGE_COLORS[0] },
  "30–90 days": { label: "30–90 days", color: AGE_COLORS[1] },
  "90–180 days": { label: "90–180 days", color: AGE_COLORS[2] },
  "> 180 days": { label: "> 180 days", color: AGE_COLORS[3] },
  count: { label: "Cases", color: "hsl(220, 15%, 50%)" },
} satisfies ChartConfig;

const actionChartConfig = {
  completed: { label: "Completed", color: "hsl(142, 71%, 45%)" },
  pending: { label: "Pending", color: "hsl(0, 84%, 60%)" },
} satisfies ChartConfig;

const progressChartConfig = {
  entries: { label: "Progress Entries", color: "hsl(217, 91%, 60%)" },
} satisfies ChartConfig;

const officerChartConfig = {
  cases: { label: "Cases", color: "hsl(262, 83%, 58%)" },
} satisfies ChartConfig;

const sectionChartConfig = {
  count: { label: "Cases", color: "hsl(217, 91%, 60%)" },
} satisfies ChartConfig;

// ─── Case Holder Dashboard ─────────────────────────

function CaseHolderDashboard() {
  const [cases, setCases] = useState<{
    id: number;
    uid: string;
    crimeNumber: string;
    dateOfRegistration: string;
    sectionOfLaw: string;
    stage: { code: string; name: string };
    actions: { id: number; isCompleted: boolean }[];
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cases?limit=100")
      .then((r) => r.json())
      .then((json) => setCases(json.data || []))
      .finally(() => setLoading(false));
  }, []);

  const stageCounts = useMemo(
    () =>
      ["UI", "PT", "HC", "SC"].map((code) => ({
        code,
        count: cases.filter((c) => c.stage.code === code).length,
      })),
    [cases]
  );

  const totalCases = useMemo(() => stageCounts.reduce((s, c) => s + c.count, 0), [stageCounts]);

  const pieData = useMemo(
    () => stageCounts.map((s) => ({ name: s.code, value: s.count })),
    [stageCounts]
  );

  // Case age distribution for current user's cases
  const caseAgeData = useMemo(() => {
    const buckets = { "< 30 days": 0, "30–90 days": 0, "90–180 days": 0, "> 180 days": 0 };
    const now = new Date();
    for (const c of cases) {
      const days = Math.floor((now.getTime() - new Date(c.dateOfRegistration).getTime()) / 86400000);
      if (days < 30) buckets["< 30 days"]++;
      else if (days < 90) buckets["30–90 days"]++;
      else if (days < 180) buckets["90–180 days"]++;
      else buckets["> 180 days"]++;
    }
    return Object.entries(buckets).map(([bracket, count]) => ({ bracket, count }));
  }, [cases]);

  // Radar data — profile of workload
  const radarData = useMemo(() => {
    const totalActions = cases.reduce((s, c) => s + (c.actions?.length || 0), 0);
    const completedActions = cases.reduce((s, c) => s + (c.actions?.filter((a) => a.isCompleted).length || 0), 0);
    const pendingActions = totalActions - completedActions;
    return [
      { metric: "UI Cases", value: stageCounts.find((s) => s.code === "UI")?.count || 0 },
      { metric: "PT Cases", value: stageCounts.find((s) => s.code === "PT")?.count || 0 },
      { metric: "HC Cases", value: stageCounts.find((s) => s.code === "HC")?.count || 0 },
      { metric: "SC Cases", value: stageCounts.find((s) => s.code === "SC")?.count || 0 },
      { metric: "Pending Actions", value: pendingActions },
      { metric: "Done Actions", value: completedActions },
    ];
  }, [cases, stageCounts]);

  const radarConfig = {
    value: { label: "Count", color: "hsl(217, 91%, 60%)" },
  } satisfies ChartConfig;

  if (loading) {
    return (
      <div>
        <SkeletonPageHeader buttonWidth="w-36" />
        <SkeletonKpiRow />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChartCard shape="donut" delay={0} />
          <SkeletonChartCard shape="radar" delay={1} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/print"><Printer className="h-4 w-4" /> Print Report</Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {stageCounts.map((s) => (
          <Card key={s.code} className="py-4">
            <CardContent className="pb-0">
              <StageBadge code={s.code} showFullName />
              <div className="text-3xl font-bold text-foreground mt-3">{s.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1: Donut + Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Case Distribution</CardTitle>
            <CardDescription>By current stage</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageChartConfig} className="mx-auto aspect-square max-h-[280px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  strokeWidth={4}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_FILLS[i % PIE_FILLS.length]} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="text-3xl font-bold fill-foreground">
                              {totalCases}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="text-sm fill-muted-foreground">
                              Cases
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Cases by Stage</CardTitle>
            <CardDescription>Your assigned cases breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageChartConfig} className="max-h-[300px] w-full">
              <BarChart data={stageCounts.map((s) => ({ stage: s.code, count: s.count }))}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="stage" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {stageCounts.map((s, i) => (
                    <Cell key={s.code} fill={PIE_FILLS[i % PIE_FILLS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Case Age Radial + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Case Age Distribution — Radial Bar */}
        <Card>
          <CardHeader>
            <CardTitle>Case Age Analysis</CardTitle>
            <CardDescription>How old are your active cases</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={ageChartConfig} className="mx-auto aspect-square max-h-[300px]">
              <RadialBarChart
                data={caseAgeData.map((d, i) => ({ ...d, fill: AGE_COLORS[i] }))}
                innerRadius={30}
                outerRadius={130}
                startAngle={180}
                endAngle={0}
              >
                <ChartTooltip content={<ChartTooltipContent nameKey="bracket" />} />
                <RadialBar dataKey="count" background cornerRadius={6} />
              </RadialBarChart>
            </ChartContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {caseAgeData.map((d, i) => (
                <div key={d.bracket} className="flex items-center gap-1.5 text-xs">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: AGE_COLORS[i] }} />
                  {d.bracket}: <span className="font-semibold">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Radar Chart — Workload Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Workload Profile</CardTitle>
            <CardDescription>Cases &amp; actions overview</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={radarConfig} className="mx-auto aspect-square max-h-[300px]">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Radar
                  dataKey="value"
                  fill="hsl(217, 91%, 60%)"
                  fillOpacity={0.3}
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={2}
                />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Cases Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Cases</CardTitle>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <p className="text-muted-foreground text-sm">No cases assigned to you.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case UID</TableHead>
                    <TableHead>Crime No.</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.slice(0, 10).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.uid}</TableCell>
                      <TableCell>{c.crimeNumber}</TableCell>
                      <TableCell><StageBadge code={c.stage.code} /></TableCell>
                      <TableCell>
                        <Link href={`/cases/${c.id}`} className="text-navy hover:underline text-sm">
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Supervisory Dashboard ─────────────────────────

const ALL_BRANCHES = "all";

function SupervisoryDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [branchFilter, setBranchFilter] = useState(ALL_BRANCHES);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Separate "applied" state so dates only take effect when Apply is clicked.
  // Branch filter auto-applies immediately on change.
  const [appliedFilters, setAppliedFilters] = useState({ branchId: ALL_BRANCHES, dateFrom: "", dateTo: "" });

  const fetchDashboard = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (appliedFilters.branchId !== ALL_BRANCHES) params.set("branchId", appliedFilters.branchId);
    if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
    if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);

    fetch(`/api/dashboard?${params}`)
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .finally(() => setLoading(false));
  }, [appliedFilters]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ─── Derived chart data ──────────────────────

  const filteredBranches = useMemo(
    () =>
      data?.branches.filter(
        (b) => appliedFilters.branchId === ALL_BRANCHES || b.branchId === parseInt(appliedFilters.branchId)
      ) || [],
    [data, appliedFilters.branchId]
  );

  const filteredTotalCases = useMemo(
    () => filteredBranches.reduce((s, b) => s + b.total, 0),
    [filteredBranches]
  );

  const kpiStages = useMemo(
    () =>
      ["UI", "PT", "HC", "SC"].map((stageCode) => ({
        code: stageCode,
        total: filteredBranches.reduce(
          (sum, b) =>
            sum + (b.stages.find((s) => s.stageCode === stageCode)?.count || 0),
          0
        ),
      })),
    [filteredBranches]
  );

  const pieData = useMemo(
    () =>
      (data?.stageDistribution || []).map((s) => ({
        name: s.stage,
        value: s.count,
      })),
    [data]
  );

  const barChartData = useMemo(
    () =>
      filteredBranches.map((b) => ({
        branch: b.branchCode,
        UI: b.stages.find((s) => s.stageCode === "UI")?.count || 0,
        PT: b.stages.find((s) => s.stageCode === "PT")?.count || 0,
        HC: b.stages.find((s) => s.stageCode === "HC")?.count || 0,
        SC: b.stages.find((s) => s.stageCode === "SC")?.count || 0,
      })),
    [filteredBranches]
  );

  // Radar data — Branch comparison profile
  const radarData = useMemo(
    () =>
      ["UI", "PT", "HC", "SC"].map((code) => ({
        stage: stageChartConfig[code as keyof typeof stageChartConfig]?.label || code,
        ...Object.fromEntries(
          filteredBranches.map((b) => [
            b.branchCode,
            b.stages.find((s) => s.stageCode === code)?.count || 0,
          ])
        ),
      })),
    [filteredBranches]
  );

  const radarConfig = useMemo(() => {
    const config: Record<string, { label: string; color: string }> = {};
    filteredBranches.forEach((b, i) => {
      config[b.branchCode] = {
        label: b.branchName,
        color: BRANCH_COLORS[i % BRANCH_COLORS.length],
      };
    });
    return config as ChartConfig;
  }, [filteredBranches]);

  // Action completion pie
  const actionPieData = useMemo(() => {
    if (!data?.actionCompletion) return [];
    return [
      { name: "completed", value: data.actionCompletion.completed },
      { name: "pending", value: data.actionCompletion.pending },
    ];
  }, [data]);

  const printHref = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedFilters.branchId !== ALL_BRANCHES) params.set("branchId", appliedFilters.branchId);
    if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
    if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);
    const qs = params.toString();
    return qs ? `/dashboard/print?${qs}` : "/dashboard/print";
  }, [appliedFilters]);

  if (loading && !data) {
    return (
      <div>
        <SkeletonPageHeader buttonWidth="w-36" />
        <SkeletonKpiRow />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <SkeletonChartCard shape="donut" delay={0} />
          <SkeletonChartCard shape="bars" delay={1} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChartCard shape="radar" delay={2} />
          <SkeletonChartCard shape="area" delay={3} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Supervisory Dashboard</h1>
        <Button asChild variant="outline" size="sm">
          <Link href={printHref}><Printer className="h-4 w-4" /> Print Report</Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6 py-4">
        <CardContent className="pb-0">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs text-muted-foreground">Branch</label>
              <Select
                value={branchFilter}
                onValueChange={(val) => {
                  setBranchFilter(val);
                  setAppliedFilters((prev) => ({ ...prev, branchId: val }));
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_BRANCHES}>All Branches</SelectItem>
                  {data?.branches.map((b) => (
                    <SelectItem key={b.branchId} value={String(b.branchId)}>
                      {b.branchName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DatePicker
              label="Date From"
              value={dateFrom}
              onChange={setDateFrom}
              className="min-w-[160px]"
            />
            <DatePicker
              label="Date To"
              value={dateTo}
              onChange={setDateTo}
              className="min-w-[160px]"
            />
            <Button
              onClick={() => setAppliedFilters({ branchId: branchFilter, dateFrom, dateTo })}
              className="bg-navy hover:bg-navy-light"
            >
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Stage Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiStages.map((s) => (
          <Card key={s.code} className="py-4">
            <CardContent className="pb-0">
              <StageBadge code={s.code} showFullName />
              <div className="text-3xl font-bold text-foreground mt-3">{s.total}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPI Summary Cards + Mini Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Left: 2x2 KPI cards */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="py-4">
            <CardContent className="pb-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Active Cases</p>
              <div className="text-4xl font-bold text-navy mt-2">{filteredTotalCases}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {filteredBranches.length} branch{filteredBranches.length !== 1 ? "es" : ""}
              </p>
            </CardContent>
          </Card>

          <Card className="py-4">
            <CardContent className="pb-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Action Completion</p>
              <div className="text-4xl font-bold mt-2 text-success">
                {data?.actionCompletion?.total
                  ? `${Math.round((data.actionCompletion.completed / data.actionCompletion.total) * 100)}%`
                  : "0%"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data?.actionCompletion?.completed || 0} of {data?.actionCompletion?.total || 0} actions done
              </p>
            </CardContent>
          </Card>

          <Card className="py-4">
            <CardContent className="pb-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Actions</p>
              <div className="text-4xl font-bold mt-2 text-warning">
                {(data?.actionCompletion?.total || 0) - (data?.actionCompletion?.completed || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting completion
              </p>
            </CardContent>
          </Card>

          <Card className="py-4">
            <CardContent className="pb-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Branches</p>
              <div className="text-4xl font-bold mt-2 text-foreground">{filteredBranches.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active units
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right: Stage Distribution Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Stage Distribution</CardTitle>
            <CardDescription>Overall case status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageChartConfig} className="mx-auto aspect-[4/2] max-h-[200px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  strokeWidth={3}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_FILLS[i % PIE_FILLS.length]} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="text-2xl font-bold fill-foreground">
                              {filteredTotalCases}
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="text-xs fill-muted-foreground">
                              Total
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1: Stacked Bar + Area Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Stacked Bar Chart — Branch-wise */}
        <Card>
          <CardHeader>
            <CardTitle>Cases by Branch</CardTitle>
            <CardDescription>Stacked by case stage</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageChartConfig} className="max-h-[320px] w-full">
              <BarChart data={barChartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="branch" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="UI" stackId="a" fill={STAGE_COLORS.UI} radius={[0, 0, 0, 0]} />
                <Bar dataKey="PT" stackId="a" fill={STAGE_COLORS.PT} radius={[0, 0, 0, 0]} />
                <Bar dataKey="HC" stackId="a" fill={STAGE_COLORS.HC} radius={[0, 0, 0, 0]} />
                <Bar dataKey="SC" stackId="a" fill={STAGE_COLORS.SC} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Area Chart — Monthly Registration Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Registration Trend</CardTitle>
            <CardDescription>Cases registered over the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={stageChartConfig} className="max-h-[320px] w-full">
              <AreaChart data={data?.monthlyTrend || []}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <defs>
                  <linearGradient id="fillUI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STAGE_COLORS.UI} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={STAGE_COLORS.UI} stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillPT" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STAGE_COLORS.PT} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={STAGE_COLORS.PT} stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillHC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STAGE_COLORS.HC} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={STAGE_COLORS.HC} stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="fillSC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STAGE_COLORS.SC} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={STAGE_COLORS.SC} stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="UI" stroke={STAGE_COLORS.UI} fill="url(#fillUI)" stackId="1" />
                <Area type="monotone" dataKey="PT" stroke={STAGE_COLORS.PT} fill="url(#fillPT)" stackId="1" />
                <Area type="monotone" dataKey="HC" stroke={STAGE_COLORS.HC} fill="url(#fillHC)" stackId="1" />
                <Area type="monotone" dataKey="SC" stroke={STAGE_COLORS.SC} fill="url(#fillSC)" stackId="1" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Radar + Progress Activity Line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Radar Chart — Branch Comparison */}
        <Card>
          <CardHeader>
            <CardTitle>Branch Comparison Profile</CardTitle>
            <CardDescription>Comparative view across stages per branch</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={radarConfig} className="mx-auto aspect-square max-h-[320px]">
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                {filteredBranches.map((b, i) => (
                  <Radar
                    key={b.branchCode}
                    dataKey={b.branchCode}
                    fill={BRANCH_COLORS[i % BRANCH_COLORS.length]}
                    fillOpacity={0.15}
                    stroke={BRANCH_COLORS[i % BRANCH_COLORS.length]}
                    strokeWidth={2}
                  />
                ))}
                <ChartLegend content={<ChartLegendContent />} />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Line Chart — Progress Activity Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Progress Activity Trend</CardTitle>
            <CardDescription>Officer productivity — entries logged per month</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={progressChartConfig} className="max-h-[320px] w-full">
              <LineChart data={data?.monthlyProgress || []}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="entries"
                  stroke="hsl(217, 91%, 60%)"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "hsl(217, 91%, 60%)" }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3: Case Age Radial + Action Completion Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Radial Bar — Case Age Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Case Age Distribution</CardTitle>
            <CardDescription>Age of active cases since registration</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={ageChartConfig} className="mx-auto aspect-square max-h-[300px]">
              <RadialBarChart
                data={(data?.caseAgeDistribution || []).map((d, i) => ({ ...d, fill: AGE_COLORS[i] }))}
                innerRadius={30}
                outerRadius={130}
                startAngle={180}
                endAngle={0}
              >
                <ChartTooltip content={<ChartTooltipContent nameKey="bracket" />} />
                <RadialBar dataKey="count" background cornerRadius={6} />
              </RadialBarChart>
            </ChartContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {(data?.caseAgeDistribution || []).map((d, i) => (
                <div key={d.bracket} className="flex items-center gap-1.5 text-xs">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: AGE_COLORS[i] }} />
                  {d.bracket}: <span className="font-semibold">{d.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart — Action Completion Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Action Completion Rate</CardTitle>
            <CardDescription>Completed vs pending action items</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={actionChartConfig} className="mx-auto aspect-square max-h-[300px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={actionPieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  strokeWidth={4}
                >
                  <Cell fill="hsl(142, 71%, 45%)" />
                  <Cell fill="hsl(0, 84%, 60%)" />
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        const pct = data?.actionCompletion?.total
                          ? Math.round((data.actionCompletion.completed / data.actionCompletion.total) * 100)
                          : 0;
                        return (
                          <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                            <tspan x={viewBox.cx} y={viewBox.cy} className="text-3xl font-bold fill-foreground">
                              {pct}%
                            </tspan>
                            <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="text-sm fill-muted-foreground">
                              Done
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  />
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 4: Officer Workload + Top Sections of Law */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Horizontal Bar — Officer Workload */}
        <Card>
          <CardHeader>
            <CardTitle>Officer Workload</CardTitle>
            <CardDescription>Top officers by case assignment</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={officerChartConfig} className="max-h-[350px] w-full">
              <BarChart data={data?.officerWorkload || []} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="officer" tickLine={false} axisLine={false} width={120} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="cases" fill="hsl(262, 83%, 58%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Bar Chart — Top Sections of Law */}
        <Card>
          <CardHeader>
            <CardTitle>Top Sections of Law</CardTitle>
            <CardDescription>Most common crime sections across cases</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={sectionChartConfig} className="max-h-[350px] w-full">
              <BarChart data={data?.topSections || []} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="section" tickLine={false} axisLine={false} width={140} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(217, 91%, 60%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Branch-wise Summary Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Branch wise Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-center">UI</TableHead>
                  <TableHead className="text-center">PT</TableHead>
                  <TableHead className="text-center">HC</TableHead>
                  <TableHead className="text-center">SC</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBranches.map((b) => (
                  <TableRow key={b.branchId}>
                    <TableCell className="font-medium">{b.branchName}</TableCell>
                    {["UI", "PT", "HC", "SC"].map((code) => (
                      <TableCell key={code} className="text-center">
                        {b.stages.find((s) => s.stageCode === code)?.count || 0}
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-semibold">{b.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Progress Details (when date range is selected) */}
      {data?.progressEntries && data.progressEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Progress Details ({dateFrom} to {dateTo})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case UID</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Action To Be Taken</TableHead>
                    <TableHead>Officer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.progressEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.case.uid}</TableCell>
                      <TableCell>{entry.case.branch.name}</TableCell>
                      <TableCell>{new Date(entry.progressDate).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell className="max-w-xs truncate">{entry.progressDetails}</TableCell>
                      <TableCell className="max-w-xs">
                        {entry.case.actions.length > 0 ? (
                          <ul className="list-disc pl-4 space-y-0.5">
                            {entry.case.actions.map((a) => (
                              <li key={a.id}>{a.description}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{entry.createdBy.fullName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Dashboard Page ───────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return user.isSupervisory ? <SupervisoryDashboard /> : <CaseHolderDashboard />;
}
