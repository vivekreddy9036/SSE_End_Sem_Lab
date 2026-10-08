"use client";

import { useAuth } from "@/components/AuthProvider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Shield,
  KeyRound,
  Database,
  ScrollText,
  UserCircle,
  ShieldCheck,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  APPROVER: "Approver",
  AUDITOR: "Auditor",
  USER: "Standard User",
};

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { href: "/access-requests", label: "My Access Requests", icon: ClipboardList, adminOnly: false },
  { href: "/admin/access-requests", label: "Approval Queue", icon: ClipboardList, adminOnly: false },
  { href: "/admin/users", label: "Users", icon: Users, adminOnly: true },
  { href: "/admin/roles", label: "Roles", icon: Shield, adminOnly: true },
  { href: "/admin/permissions", label: "Permissions", icon: KeyRound, adminOnly: true },
  { href: "/admin/resources", label: "Resources", icon: Database, adminOnly: true },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText, adminOnly: false },
];

export default function AppSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const isAdmin = user.roleCode === "ADMIN";
  const canApprove = user.permissions.some((p) => p.endsWith("_APPROVE"));
  const canReadAudit = user.permissions.includes("AUDIT_LOG_READ");

  const visibleItems = navItems.filter((item) => {
    if (item.href === "/admin/access-requests") return canApprove;
    if (item.href === "/admin/audit-log") return canReadAudit;
    if (item.adminOnly) return isAdmin;
    return true;
  });

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border h-16 justify-center">
        <div className="flex items-center gap-2 px-1">
          <ShieldCheck className="h-8 w-8 shrink-0" />
          <div className="flex flex-col leading-tight overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold text-navy">SentinelIAM</span>
            <span className="text-[10px] text-muted-foreground truncate">
              Identity &amp; Access Management
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-2">
          <UserCircle className="h-7 w-7 shrink-0 text-muted-foreground" />
          <div className="flex flex-col leading-tight overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-medium truncate">{user.fullName}</span>
            <span className="text-xs text-muted-foreground">
              {ROLE_LABELS[user.roleCode] ?? user.roleCode}
            </span>
            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
