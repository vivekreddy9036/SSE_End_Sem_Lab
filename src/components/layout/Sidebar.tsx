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
  FolderOpen,
  FolderKanban,
  FilePlus,
  Shield,
  UserCircle,
} from "lucide-react";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    supervisoryOnly: true,
  },
  {
    href: "/cases",
    label: "My Cases",
    icon: FolderOpen,
    supervisoryOnly: false,
  },
  {
    href: "/all-cases",
    label: "All Cases",
    icon: FolderKanban,
    supervisoryOnly: true,
  },
  {
    href: "/cases/new",
    label: "New Case",
    icon: FilePlus,
    supervisoryOnly: false,
  },
];

export default function AppSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const visibleItems = navItems.filter(
    (item) => !item.supervisoryOnly || user.isSupervisory
  );

  const isActive = (href: string) =>
    pathname === href ||
    (href === "/cases" &&
      pathname.startsWith("/cases/") &&
      pathname !== "/cases/new") ||
    (href === "/all-cases" && pathname.startsWith("/all-cases/"));

  return (
    <Sidebar collapsible="icon">
      {/* Header: CoATS branding */}
      <SidebarHeader className="border-b border-sidebar-border h-16 justify-center">
        <div className="flex items-center gap-2 px-1">
          <img
            src="/coats_favicon.png"
            alt="CoATS"
            className="h-8 w-8 shrink-0 rounded-md object-cover"
          />
          <div className="flex flex-col leading-tight overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold text-navy">CoATS</span>
            <span className="text-[10px] text-muted-foreground truncate">
              Anti Terrorism Squad
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Navigation */}
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

      {/* Footer: user info */}
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-1 py-2">
          <UserCircle className="h-7 w-7 shrink-0 text-muted-foreground" />
          <div className="flex flex-col leading-tight overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-medium truncate">{user.fullName}</span>
            <span className="text-xs text-muted-foreground truncate">
              {user.isSupervisory ? "Supervisory Officer" : "Case Holding Officer"}
            </span>
            <span className="text-xs text-muted-foreground">{user.username}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
