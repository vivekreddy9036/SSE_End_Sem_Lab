"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Spinner from "@/components/ui/Spinner";

interface AuditRow {
  id: number;
  action: string;
  detail: string | null;
  ipAddress: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/audit-log?page=${page}&limit=25`)
      .then((r) => r.json())
      .then((json) => {
        setEntries(json.data || []);
        setTotalPages(json.pagination?.totalPages || 1);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Audit Log</h1>

      <Card>
        <CardHeader>
          <CardTitle>Security Events</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Spinner className="py-8" />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.action}</TableCell>
                      <TableCell className="text-sm">
                        <div>{e.userName}</div>
                        <div className="text-xs text-muted-foreground">{e.userEmail}</div>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">{e.detail}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.ipAddress}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(e.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    setLoading(true);
                    setPage((p) => p - 1);
                  }}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => {
                    setLoading(true);
                    setPage((p) => p + 1);
                  }}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
