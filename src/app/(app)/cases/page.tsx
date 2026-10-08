"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import StageBadge from "@/components/ui/StageBadge";
import { SkeletonTable } from "@/components/ui/skeletons";
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
import { Search, Plus } from "lucide-react";

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

interface Stage {
  id: number;
  code: string;
  name: string;
}

const ALL_STAGES = "all";

export default function MyCasesPage() {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stageFilter, setStageFilter] = useState(ALL_STAGES);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/stages")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => setStages(json.data || []))
      .catch(() => setStages([]));
  }, []);

  const fetchCases = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "15" });
    if (stageFilter !== ALL_STAGES) params.set("stageId", stageFilter);
    if (search) params.set("search", search);

    fetch(`/api/cases?${params}`)
      .then((r) => r.json())
      .then((json) => {
        setCases(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
      })
      .finally(() => setLoading(false));
  }, [page, stageFilter, search]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">My Cases</h1>
        <Button asChild className="bg-navy hover:bg-navy-light">
          <Link href="/cases/new">
            <Plus className="h-4 w-4" />
            New Case
          </Link>
        </Button>
      </div>

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
            value={stageFilter}
            onValueChange={(val) => { setStageFilter(val); setPage(1); }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STAGES}>All Stages</SelectItem>
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
          <SkeletonTable rows={8} cols={7} />
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
                      <TableCell>{c.complainantName}</TableCell>
                      <TableCell>{new Date(c.dateOfRegistration).toLocaleDateString("en-IN")}</TableCell>
                      <TableCell><StageBadge code={c.stage.code} /></TableCell>
                      <TableCell>{c.assignedOfficer.fullName}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button asChild variant="ghost" size="sm" className="text-navy h-7 px-2">
                            <Link href={`/cases/${c.id}`}>View</Link>
                          </Button>
                          <Button asChild variant="ghost" size="sm" className="text-success h-7 px-2">
                            <Link href={`/cases/${c.id}/progress`}>Progress</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
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
