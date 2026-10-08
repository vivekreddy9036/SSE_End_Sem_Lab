"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
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

interface PermissionOption {
  id: number;
  code: string;
  name: string;
  action: string;
  resource: { code: string; name: string; sensitivity: string };
}

interface RequestRow {
  id: number;
  status: string;
  justification: string;
  permission: { code: string; name: string; action: string };
  resource: { code: string; name: string };
  reviewedByName: string | null;
  reviewNote: string | null;
  createdAt: string;
}

function statusVariant(status: string) {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED" || status === "REVOKED") return "destructive";
  return "secondary";
}

export default function AccessRequestsPage() {
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionId, setPermissionId] = useState("");
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    Promise.all([
      fetch("/api/permissions").then((r) => r.json()),
      fetch("/api/access-requests").then((r) => r.json()),
    ])
      .then(([permJson, reqJson]) => {
        setPermissions(permJson.data || []);
        setRequests(reqJson.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId: parseInt(permissionId, 10), justification }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Failed to submit request");
      setPermissionId("");
      setJustification("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">My Access Requests</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Request access to a resource</CardTitle>
          <CardDescription>
            An approver with authority over that resource will review your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Permission</Label>
              <Select value={permissionId} onValueChange={setPermissionId}>
                <SelectTrigger className="w-full sm:w-[360px]"><SelectValue placeholder="Select a permission" /></SelectTrigger>
                <SelectContent>
                  {permissions.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.resource.name} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="justification">Justification</Label>
              <Textarea
                id="justification"
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Why do you need this access? (minimum 10 characters)"
                required
                minLength={10}
              />
            </div>
            <Button type="submit" disabled={submitting || !permissionId} className="bg-navy hover:bg-navy-light">
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Spinner className="py-8" />
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">You haven&apos;t submitted any access requests yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Permission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reviewer</TableHead>
                  <TableHead>Requested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.resource.name}</TableCell>
                    <TableCell>{r.permission.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                      {r.reviewNote && <div className="text-xs text-muted-foreground mt-1">{r.reviewNote}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{r.reviewedByName ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString()}
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
