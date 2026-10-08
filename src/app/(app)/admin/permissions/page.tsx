"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus } from "lucide-react";

interface PermissionRow {
  id: number;
  code: string;
  name: string;
  action: string;
  resource: { id: number; code: string; name: string };
}

interface ResourceOption {
  id: number;
  code: string;
  name: string;
}

const ACTIONS = ["READ", "WRITE", "APPROVE", "MANAGE", "ADMIN"];

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [resources, setResources] = useState<ResourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [action, setAction] = useState("READ");
  const [resourceId, setResourceId] = useState("");

  const load = () => {
    Promise.all([
      fetch("/api/admin/permissions").then((r) => r.json()),
      fetch("/api/admin/resources").then((r) => r.json()),
    ])
      .then(([permJson, resJson]) => {
        setPermissions(permJson.data || []);
        setResources(resJson.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, action, resourceId: parseInt(resourceId, 10) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Failed to create permission");
      setOpen(false);
      setCode("");
      setName("");
      setAction("READ");
      setResourceId("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create permission");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Permissions</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-navy hover:bg-navy-light" disabled={resources.length === 0}>
              <Plus className="h-4 w-4" /> New Permission
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Define a new permission</DialogTitle>
            </DialogHeader>
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="PAYROLL_READ" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="View payroll data" required />
              </div>
              <div className="space-y-1.5">
                <Label>Action</Label>
                <Select value={action} onValueChange={setAction}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Resource</Label>
                <Select value={resourceId} onValueChange={setResourceId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select resource" /></SelectTrigger>
                  <SelectContent>
                    {resources.map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving || !resourceId} className="bg-navy hover:bg-navy-light">
                  {saving ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Spinner className="py-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permissions.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell><Badge variant="outline">{p.action}</Badge></TableCell>
                    <TableCell className="text-sm">{p.resource.name}</TableCell>
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
