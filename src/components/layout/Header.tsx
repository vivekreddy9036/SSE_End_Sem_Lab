"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/AuthProvider";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { MapPin, Moon, Sun } from "lucide-react";
import NotificationBell from "@/components/layout/NotificationBell";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: next-themes only knows the real theme client-side.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-8 w-8" />;

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-1.5 rounded-md hover:bg-white/20 transition-colors cursor-pointer"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
    </button>
  );
}

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 h-16 bg-navy text-white flex items-center gap-2 px-4 shadow-md">
      <SidebarTrigger className="text-white hover:bg-white/20 hover:text-white" />
      <Separator orientation="vertical" className="h-5 bg-white/30" />
      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/coats_icon_header.png"
            alt="CoATS"
            className="h-9 w-auto object-contain"
          />
          <img
            src="/coats_header_beside.png"
            alt=""
            className="h-7 w-auto object-contain hidden sm:block"
          />
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end text-sm">
              <span className="font-medium">{user.fullName}</span>
              <span className="text-xs text-white/70">
                {user.isSupervisory ? "Supervisory Officer" : "Case Holding Officer"} — {user.branchCode}
              </span>
              {user.lastLoginLocation && (
                <span className="text-xs text-white/50 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {user.lastLoginLocation}
                </span>
              )}
            </div>
            <NotificationBell />
            <ThemeToggle />
            <button
              onClick={logout}
              className="px-3 py-1.5 text-sm bg-white/10 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
