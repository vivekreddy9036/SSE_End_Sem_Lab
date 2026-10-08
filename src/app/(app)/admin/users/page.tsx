"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface UserRow {
  id: number;
  email: string;
  fullName: string;
  isActive: boolean;
  lockedUntil: string | null;
  role: { id: number; code: string; name: string };
  totpEnabled: boolean;
  passkeyEnabled: boolean;
  lastLogin: string | null;
}

interface RoleOption {
  id: number;
  code: string;
  name: string;
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);

  const load = () => {
    Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/roles").then((r) => r.json()),
    ])
      .then(([userJson, roleJson]) => {
        setUsers(userJson.data || []);
        setRoles(roleJson.data || []);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const changeRole = async (userId: number, roleId: number) => {
    setError("");
    setPendingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Failed to update role");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setPendingId(null);
    }
  };

  const toggleActive = async (userId: number, isActive: boolean) => {
    setError("");
    setPendingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "Failed to update status");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Users</h1>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Spinner className="py-8" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>2FA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.id === me?.userId;
                  const isLocked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.fullName}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={String(u.role.id)}
                          onValueChange={(val) => changeRole(u.id, parseInt(val, 10))}
                          disabled={isSelf || pendingId === u.id}
                        >
                          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {roles.map((r) => (
                              <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {u.totpEnabled || u.passkeyEnabled ? (
                          <Badge variant="outline">
                            {[u.totpEnabled && "TOTP", u.passkeyEnabled && "Passkey"].filter(Boolean).join(" + ")}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set up</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!u.isActive ? (
                          <Badge variant="destructive">Deactivated</Badge>
                        ) : isLocked ? (
                          <Badge variant="secondary">Locked</Badge>
                        ) : (
                          <Badge>Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSelf || pendingId === u.id}
                          onClick={() => toggleActive(u.id, !u.isActive)}
                        >
                          {u.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
