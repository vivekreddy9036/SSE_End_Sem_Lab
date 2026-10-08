"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Check, X } from "lucide-react";

interface RequestRow {
  id: number;
  status: string;
  justification: string;
  requester: { fullName: string; email: string };
  permission: { id: number; code: string; name: string; action: string };
  resource: { code: string; name: string; sensitivity: string };
  reviewedByName: string | null;
  reviewNote: string | null;
  createdAt: string;
}

function statusVariant(status: string) {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED" || status === "REVOKED") return "destructive";
  return "secondary";
}

export default function AdminAccessRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = () => {
    fetch("/api/admin/access-requests")
      .then((r) => r.json())
      .then((json) => setRequests(json.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const review = async (id: number, decision: "APPROVED" | "REJECTED") => {
    setError("");
    setPendingId(id);
    try {
      const res = await fetch(`/api/admin/access-requests/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Failed to review request");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to review request");
    } finally {
      setPendingId(null);
    }
  };

  const visible = showAll ? requests : requests.filter((r) => r.status === "PENDING");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Approval Queue</h1>
        <Button variant="outline" size="sm" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show pending only" : "Show all"}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{showAll ? "All Requests" : "Pending Requests"}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Spinner className="py-8" />
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to review right now.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requester</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Permission</TableHead>
                  <TableHead>Justification</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.requester.fullName}</div>
                      <div className="text-xs text-muted-foreground">{r.requester.email}</div>
                    </TableCell>
                    <TableCell>
                      <div>{r.resource.name}</div>
                      <Badge variant="outline" className="mt-1">{r.resource.sensitivity}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.permission.name}</TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">{r.justification}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "PENDING" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={pendingId === r.id}
                            onClick={() => review(r.id, "APPROVED")}
                            className="bg-navy hover:bg-navy-light"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pendingId === r.id}
                            onClick={() => review(r.id, "REJECTED")}
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{r.reviewedByName}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
