"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Clock, AlertTriangle, UserRoundCheck, ListTodo } from "lucide-react";
import type { NotificationItem } from "@/app/api/notifications/route";

const POLL_INTERVAL = 3 * 60 * 1000;

function lastSeenKey(userId: number) {
  return `coats:notifications:lastSeen:${userId}`;
}

const typeIcon: Record<NotificationItem["type"], typeof Bell> = {
  pending_action: ListTodo,
  reminder: Clock,
  reassignment: UserRoundCheck,
};

const severityColor: Record<NotificationItem["severity"], string> = {
  overdue: "text-destructive",
  upcoming: "text-warning",
  info: "text-muted-foreground",
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [lastSeen, setLastSeen] = useState<number>(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((json) => setItems(json.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    // Reading localStorage is a browser-only sync, not derived React state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastSeen(Number(localStorage.getItem(lastSeenKey(user.userId)) || 0));
    fetchNotifications();
    const timer = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [user, fetchNotifications]);

  if (!user) return null;

  const unreadCount = items.filter((n) => new Date(n.createdAt).getTime() > lastSeen).length;

  const markAllRead = () => {
    const now = Date.now();
    localStorage.setItem(lastSeenKey(user.userId), String(now));
    setLastSeen(now);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) fetchNotifications();
        else markAllRead();
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="relative p-1.5 rounded-md hover:bg-white/20 transition-colors cursor-pointer"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-[10px] leading-4 text-white text-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {items.length > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-navy hover:underline cursor-pointer"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">You&apos;re all caught up.</p>
          ) : (
            items.map((n) => {
              const Icon = typeIcon[n.type];
              const isUnread = new Date(n.createdAt).getTime() > lastSeen;
              return (
                <Link
                  key={n.id}
                  href={n.link}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 hover:bg-accent transition-colors"
                >
                  {n.severity === "overdue" ? (
                    <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${severityColor[n.severity]}`} />
                  ) : (
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${severityColor[n.severity]}`} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                  </div>
                  {isUnread && <span className="h-2 w-2 rounded-full bg-navy mt-1.5 shrink-0" />}
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
