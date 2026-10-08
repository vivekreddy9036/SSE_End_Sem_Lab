"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Plus, Settings } from "lucide-react";

interface RoleRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionCount: number;
}

interface PermissionCheckbox {
  id: number;
  code: string;
  name: string;
  action: string;
  resource: { code: string; name: string };
  granted: boolean;
}

function CreateRoleDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name, description: description || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Failed to create role");
      setOpen(false);
      setCode("");
      setName("");
      setDescription("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create role");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-navy hover:bg-navy-light">
          <Plus className="h-4 w-4" /> New Role
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new role</DialogTitle>
        </DialogHeader>
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Code</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="MANAGER" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Manager" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving} className="bg-navy hover:bg-navy-light">
              {saving ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ManagePermissionsDialog({ role, onChanged }: { role: RoleRow; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState<PermissionCheckbox[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/admin/roles/${role.id}/permissions`)
      .then((r) => r.json())
      .then((json) => setPermissions(json.data || []))
      .finally(() => setLoading(false));
  }, [open, role.id]);

  const handleOpenChange = (next: boolean) => {
    if (next) setLoading(true);
    setOpen(next);
  };

  const toggle = async (permissionId: number, grant: boolean) => {
    setPendingId(permissionId);
    try {
      await fetch(`/api/admin/roles/${role.id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId, grant }),
      });
      setPermissions((prev) => prev.map((p) => (p.id === permissionId ? { ...p, granted: grant } : p)));
      onChanged();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-3.5 w-3.5" /> Permissions
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Permissions for {role.name}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <Spinner className="py-8" />
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {permissions.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-3 py-2 px-1 rounded hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={p.granted}
                  disabled={pendingId === p.id}
                  onCheckedChange={(checked) => toggle(p.id, checked === true)}
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.resource.name} · {p.action}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch("/api/admin/roles")
      .then((r) => r.json())
      .then((json) => setRoles(json.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Roles</h1>
        <CreateRoleDialog onCreated={load} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Roles</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Spinner className="py-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="text-right">Permissions</TableHead>
                  <TableHead className="text-right">Manage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium flex items-center gap-2">
                        {r.name}
                        {r.isSystem && <Badge variant="secondary">system</Badge>}
                      </div>
                      {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                    </TableCell>
                    <TableCell className="text-right">{r.userCount}</TableCell>
                    <TableCell className="text-right">{r.permissionCount}</TableCell>
                    <TableCell className="text-right">
                      <ManagePermissionsDialog role={r} onChanged={load} />
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
