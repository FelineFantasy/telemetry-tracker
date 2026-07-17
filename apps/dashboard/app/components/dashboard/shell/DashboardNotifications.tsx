"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellRing,
  CreditCard,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  markAllNotificationsReadAction,
  markNotificationsReadAction,
} from "@/app/dashboard/actions";
import { DashboardPopover } from "./DashboardPopover";
import type { DashboardNotificationItem } from "@/lib/dashboard-notifications";
import { formatRelativeTime } from "@/lib/format-time";
import { useDashboardNavLinkProps } from "@/lib/use-dashboard-navigation";

type Props = {
  initialItems: DashboardNotificationItem[];
};

function NotifIcon({ type }: { type: DashboardNotificationItem["type"] }) {
  const cls = "h-3.5 w-3.5";
  switch (type) {
    case "issue":
      return <AlertTriangle className={`${cls} text-destructive`} />;
    case "billing":
      return <CreditCard className={`${cls} text-warning`} />;
    case "quota":
      return <Zap className={`${cls} text-warning`} />;
    case "team":
      return <Users className={`${cls} text-brand`} />;
    case "alert":
      return <BellRing className={`${cls} text-warning`} />;
    default:
      return <Bell className={`${cls} text-brand`} />;
  }
}

export function DashboardNotifications({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const markRead = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target?.unread) return prev;
      void markNotificationsReadAction([id]).then((result) => {
        if (!result.ok) {
          setItems((current) =>
            current.map((item) =>
              item.id === id ? { ...item, unread: true } : item
            )
          );
          toast.error(result.error || "Could not mark notification as read");
        }
      });
      return prev.map((item) =>
        item.id === id ? { ...item, unread: false } : item
      );
    });
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => {
      const unreadIds = prev.filter((item) => item.unread).map((item) => item.id);
      if (unreadIds.length === 0) return prev;
      void markAllNotificationsReadAction().then((result) => {
        if (!result.ok) {
          setItems((current) =>
            current.map((item) =>
              unreadIds.includes(item.id) ? { ...item, unread: true } : item
            )
          );
          toast.error(result.error || "Could not mark notifications as read");
        }
      });
      return prev.map((item) => ({ ...item, unread: false }));
    });
  }, []);

  const viewItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        timeLabel: formatRelativeTime(item.occurredAt),
      })),
    [items]
  );

  const unread = viewItems.filter((i) => i.unread).length;
  const view = filter === "unread" ? viewItems.filter((i) => i.unread) : viewItems;

  return (
    <DashboardPopover
      align="right"
      width="w-[calc(100vw-2rem)] max-w-[380px]"
      trigger={(toggle, open) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label="Notifications"
          className="relative grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-surface/60 hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute right-1 top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-destructive px-1 font-mono text-[9px] font-medium text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium">Notifications</span>
              {unread > 0 ? (
                <span className="rounded-full bg-brand-soft px-1.5 py-0.5 font-mono text-[10px] text-brand">
                  {unread} new
                </span>
              ) : null}
            </div>
            {viewItems.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  markAllRead();
                  close();
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          {viewItems.length > 0 ? (
            <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
              {(["all", "unread"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-2 py-1 text-[11px] ${filter === f ? "bg-surface text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {f === "all" ? "All" : "Unread"}
                </button>
              ))}
            </div>
          ) : null}
          <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {view.map((n) => {
              const content = (
                <>
                  <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-background">
                    <NotifIcon type={n.type} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <p className="flex-1 truncate text-[13px]">{n.title}</p>
                      <span
                        className="shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground"
                        title={n.occurredAt}
                      >
                        {n.timeLabel}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[11.5px] text-muted-foreground">{n.body}</p>
                  </div>
                  {n.unread ? (
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  ) : null}
                </>
              );

              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link
                      href={n.href}
                      onClick={() => {
                        markRead(n.id);
                        close();
                      }}
                      className="flex cursor-pointer gap-2.5 px-3 py-2.5 hover:bg-surface/60"
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        markRead(n.id);
                        close();
                      }}
                      className="flex w-full cursor-pointer gap-2.5 px-3 py-2.5 text-left hover:bg-surface/60"
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
            {view.length === 0 ? (
              <li className="px-3 py-10 text-center text-sm text-muted-foreground">
                {viewItems.length === 0
                  ? "No notifications right now."
                  : "You're all caught up."}
              </li>
            ) : null}
          </ul>
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <NotificationSettingsLink onNavigate={close} />
            <span className="text-[11px] text-muted-foreground">
              {effectiveProjectLabel(viewItems)}
            </span>
          </div>
        </div>
      )}
    </DashboardPopover>
  );
}

function NotificationSettingsLink({ onNavigate }: { onNavigate: () => void }) {
  const linkProps = useDashboardNavLinkProps("/dashboard/settings/notifications", {
    onNavigate,
  });
  return (
    <Link
      {...linkProps}
      className="text-[11px] text-muted-foreground hover:text-foreground"
    >
      Notification settings
    </Link>
  );
}

function effectiveProjectLabel(items: DashboardNotificationItem[]): string {
  const hasIssues = items.some((i) => i.type === "issue");
  const hasBilling = items.some((i) => i.type === "billing" || i.type === "quota");
  const hasTeam = items.some((i) => i.type === "team");
  if (hasIssues && hasBilling) return "Project alerts";
  if (hasTeam && !hasIssues && !hasBilling) return "Team updates";
  if (hasIssues) return "Open issues";
  if (hasBilling) return "Billing & usage";
  return "Live data";
}
