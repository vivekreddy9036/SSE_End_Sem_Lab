"use client";

import { useAuth } from "@/components/AuthProvider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { SkeletonPageHeader, SkeletonKpiRow } from "@/components/ui/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface AdminDashboard {
  scope: "admin";
  totalUsers: number;
  activeUsers: number;
  lockedUsers: number;
  totalRoles: number;
  totalResources: number;
  totalPermissions: number;
  pendingRequests: number;
  usersByRole: { roleCode: string; roleName: string; count: number }[];
  recentAudit: { id: number; action: string; detail: string | null; userName: string; userEmail: string; createdAt: string }[];
}

interface PersonalDashboard {
  scope: "personal";
  roleCode: string;
  permissions: string[];
  myRequests: { id: number; status: string; permissionName: string; resourceName: string; createdAt: string }[];
}

type DashboardData = AdminDashboard | PersonalDashboard;

function statusVariant(status: string) {
  if (status === "APPROVED") return "default";
  if (status === "REJECTED" || status === "REVOKED") return "destructive";
  return "secondary";
}

function AdminStats({ data }: { data: AdminDashboard }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="py-4">
          <CardContent className="pb-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Users</p>
            <div className="text-3xl font-bold text-navy mt-2">{data.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">{data.activeUsers} active</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="pb-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Locked Accounts</p>
            <div className="text-3xl font-bold text-warning mt-2">{data.lockedUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">Due to failed login attempts</p>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="pb-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Pending Access Requests</p>
            <div className="text-3xl font-bold text-foreground mt-2">{data.pendingRequests}</div>
            <Link href="/admin/access-requests" className="text-xs text-navy hover:underline">
              Review queue →
            </Link>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="pb-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Resources / Permissions</p>
            <div className="text-3xl font-bold text-foreground mt-2">
              {data.totalResources} / {data.totalPermissions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{data.totalRoles} roles defined</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Users by Role</CardTitle>
            <CardDescription>Current role distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.usersByRole.map((r) => (
                  <TableRow key={r.roleCode}>
                    <TableCell>{r.roleName}</TableCell>
                    <TableCell className="text-right font-medium">{r.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Security Events</CardTitle>
            <CardDescription>Last 10 audit log entries</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentAudit.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.action}</TableCell>
                    <TableCell className="text-sm">{a.userName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PersonalStats({ data }: { data: PersonalDashboard }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Dashboard</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Your Permissions</CardTitle>
          <CardDescription>Everything your role currently grants, plus any direct grants</CardDescription>
        </CardHeader>
        <CardContent>
          {data.permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no resource access yet.{" "}
              <Link href="/access-requests" className="text-navy hover:underline">
                Request access →
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.permissions.map((p) => (
                <Badge key={p} variant="outline">{p}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between flex-row">
          <div>
            <CardTitle>Your Recent Access Requests</CardTitle>
            <CardDescription>Status of your last 10 requests</CardDescription>
          </div>
          <Button asChild size="sm" className="bg-navy hover:bg-navy-light">
            <Link href="/access-requests">New Request</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {data.myRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No access requests yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Permission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.myRequests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.resourceName}</TableCell>
                    <TableCell>{r.permissionName}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    </TableCell>
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

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((json) => setData(json.data))
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  if (loading || !data) {
    return (
      <div>
        <SkeletonPageHeader buttonWidth="w-36" />
        <SkeletonKpiRow />
      </div>
    );
  }

  return data.scope === "admin" ? <AdminStats data={data} /> : <PersonalStats data={data} />;
}
