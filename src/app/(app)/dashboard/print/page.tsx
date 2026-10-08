"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { SkeletonTable } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import PrintLetterhead from "@/components/print/PrintLetterhead";
import StageBadge from "@/components/ui/StageBadge";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface StageSummary {
  stageCode: string;
  count: number;
}

interface BranchSummary {
  branchId: number;
  branchCode: string;
  branchName: string;
  stages: StageSummary[];
  total: number;
}

interface DashboardData {
  branches: BranchSummary[];
  totalCases: number;
  actionCompletion: { completed: number; pending: number; total: number };
}

interface CaseListItem {
  id: number;
  uid: string;
  crimeNumber: string;
  dateOfRegistration: string;
  stage: { code: string; name: string };
}

function SupervisoryPrintReport() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    const branchId = searchParams.get("branchId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    if (branchId) params.set("branchId", branchId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    fetch(`/api/dashboard?${params}`)
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .finally(() => setLoading(false));
  }, [searchParams]);

  if (loading) return <PrintReportSkeleton />;
  if (!data) return null;

  return (
    <>
      <div className="grid grid-cols-4 gap-4 mb-6 text-sm print-avoid-break">
        <Stat label="Total Cases" value={data.totalCases} />
        <Stat label="Branches" value={data.branches.length} />
        <Stat
          label="Action Completion"
          value={
            data.actionCompletion.total
              ? `${Math.round((data.actionCompletion.completed / data.actionCompletion.total) * 100)}%`
              : "0%"
          }
        />
        <Stat
          label="Pending Actions"
          value={data.actionCompletion.total - data.actionCompletion.completed}
        />
      </div>

      <section className="print-avoid-break">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2 pb-1 border-b border-border">
          Branch-wise Summary
        </h2>
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
            {data.branches.map((b) => (
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
      </section>
    </>
  );
}

function CaseHolderPrintReport() {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cases?limit=100")
      .then((r) => r.json())
      .then((json) => setCases(json.data || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PrintReportSkeleton />;

  const stageCounts = ["UI", "PT", "HC", "SC"].map((code) => ({
    code,
    count: cases.filter((c) => c.stage.code === code).length,
  }));

  return (
    <>
      <div className="grid grid-cols-4 gap-4 mb-6 text-sm print-avoid-break">
        {stageCounts.map((s) => (
          <Stat key={s.code} label={s.code} value={s.count} />
        ))}
      </div>

      <section className="print-avoid-break">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-2 pb-1 border-b border-border">
          My Cases ({cases.length})
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Case UID</TableHead>
              <TableHead>Crime No.</TableHead>
              <TableHead>Date of Reg.</TableHead>
              <TableHead>Stage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.uid}</TableCell>
                <TableCell>{c.crimeNumber}</TableCell>
                <TableCell>{new Date(c.dateOfRegistration).toLocaleDateString("en-IN")}</TableCell>
                <TableCell><StageBadge code={c.stage.code} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </>
  );
}

function PrintReportSkeleton() {
  return (
    <div className="print-avoid-break">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-border rounded-lg p-3 space-y-2">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-6 w-8" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        <SkeletonTable rows={5} cols={4} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-navy mt-1">{value}</p>
    </div>
  );
}

export default function DashboardPrintPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-end mb-4 print:hidden">
        <Button onClick={() => window.print()} className="bg-navy hover:bg-navy-light">
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </Button>
      </div>

      <PrintLetterhead title={user.isSupervisory ? "Supervisory Dashboard Report" : "My Dashboard Report"} />

      {user.isSupervisory ? (
        <Suspense fallback={<PrintReportSkeleton />}>
          <SupervisoryPrintReport />
        </Suspense>
      ) : (
        <CaseHolderPrintReport />
      )}
    </div>
  );
}
