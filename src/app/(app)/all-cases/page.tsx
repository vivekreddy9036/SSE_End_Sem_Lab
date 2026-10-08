"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import StageBadge from "@/components/ui/StageBadge";
import { SkeletonTable } from "@/components/ui/skeletons";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface CaseListItem {
  id: number;
  uid: string;
  crimeNumber: string;
  complainantName: string;
  dateOfRegistration: string;
  stage: { code: string; name: string };
  branch: { code: string; name: string };
  assignedOfficer: { fullName: string };
}

interface Branch {
  id: number;
  code: string;
  name: string;
}

interface Stage {
  id: number;
  code: string;
  name: string;
}

const ALL = "all";

export default function AllCasesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stageFilter, setStageFilter] = useState(ALL);
  const [branchFilter, setBranchFilter] = useState(ALL);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user && !user.isSupervisory) router.push("/cases");
  }, [user, router]);

  useEffect(() => {
    fetch("/api/branches")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => setBranches(json.data || []))
      .catch(() => setBranches([]));
    fetch("/api/stages")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => setStages(json.data || []))
      .catch(() => setStages([]));
  }, []);

  const fetchCases = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "15" });
    if (stageFilter !== ALL) params.set("stageId", stageFilter);
    if (branchFilter !== ALL) params.set("branchId", branchFilter);
    if (search) params.set("search", search);

    fetch(`/api/cases?${params}`)
      .then((r) => r.json())
      .then((json) => {
        setCases(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
      })
      .finally(() => setLoading(false));
  }, [page, stageFilter, branchFilter, search]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  if (!user?.isSupervisory) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">All Cases</h1>

      {/* Filters */}
      <Card className="mb-6 py-4">
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by UID, crime no., complainant..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select
            value={branchFilter}
            onValueChange={(val) => { setBranchFilter(val); setPage(1); }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={stageFilter}
            onValueChange={(val) => { setStageFilter(val); setPage(1); }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Stages</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden py-0 gap-0">
        {loading ? (
          <SkeletonTable rows={10} cols={8} />
        ) : cases.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-20">No cases found.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Case UID</TableHead>
                    <TableHead>Crime No.</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Complainant</TableHead>
                    <TableHead>Date of Reg.</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Officer</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cases.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-navy">{c.uid}</TableCell>
                      <TableCell>{c.crimeNumber}</TableCell>
                      <TableCell>{c.branch.name}</TableCell>
                      <TableCell>{c.complainantName}</TableCell>
                      <TableCell>{new Date(c.dateOfRegistration).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell><StageBadge code={c.stage.code} /></TableCell>
                      <TableCell>{c.assignedOfficer.fullName}</TableCell>
                      <TableCell className="text-center">
                        <Button asChild variant="ghost" size="sm" className="text-navy h-7 px-2">
                          <Link href={`/cases/${c.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 p-4 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
