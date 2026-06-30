"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  CreditCard,
  Rocket,
  Tag,
  Users,
  Webhook,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { DashboardPopover } from "./DashboardPopover";

type Notification = {
  id: string;
  type: "issue" | "alert" | "deploy" | "release" | "billing" | "team" | "webhook";
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

const NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    type: "issue",
    title: "New error group",
    body: "TypeError in checkout flow — 482 events in the last 24h",
    time: "2m",
    unread: true,
  },
  {
    id: "n2",
    type: "billing",
    title: "Usage approaching limit",
    body: "Monthly ingest is above 80% of your plan quota",
    time: "3h",
    unread: true,
  },
  {
    id: "n3",
    type: "team",
    title: "Team invitation accepted",
    body: "A new member joined your organization",
    time: "1d",
    unread: false,
  },
];

function NotifIcon({ type }: { type: Notification["type"] }) {
  const cls = "h-3.5 w-3.5";
  switch (type) {
    case "issue":
      return <AlertTriangle className={`${cls} text-destructive`} />;
    case "alert":
      return <Bell className={`${cls} text-warning`} />;
    case "deploy":
      return <Rocket className={`${cls} text-success`} />;
    case "release":
      return <Tag className={`${cls} text-brand`} />;
    case "billing":
      return <CreditCard className={`${cls} text-warning`} />;
    case "team":
      return <Users className={`${cls} text-muted-foreground`} />;
    case "webhook":
      return <Webhook className={`${cls} text-destructive`} />;
    default:
      return <Zap className={`${cls} text-brand`} />;
  }
}

export function DashboardNotifications() {
  const [items, setItems] = useState(NOTIFICATIONS);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const unread = items.filter((i) => i.unread).length;
  const view = filter === "unread" ? items.filter((i) => i.unread) : items;

  return (
    <DashboardPopover
      align="right"
      width="w-[380px]"
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
              {unread}
            </span>
          ) : null}
        </button>
      )}
    >
      {() => (
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
            <button
              type="button"
              onClick={() => setItems((p) => p.map((i) => ({ ...i, unread: false })))}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          </div>
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
          <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {view.map((n) => (
              <li
                key={n.id}
                onClick={() =>
                  setItems((prev) =>
                    prev.map((i) => (i.id === n.id ? { ...i, unread: false } : i))
                  )
                }
                className="flex cursor-pointer gap-2.5 px-3 py-2.5 hover:bg-surface/60"
              >
                <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-background">
                  <NotifIcon type={n.type} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 truncate text-[13px]">{n.title}</p>
                    <span className="font-mono text-[10px] text-muted-foreground">{n.time}</span>
                  </div>
                  <p className="truncate text-[11.5px] text-muted-foreground">{n.body}</p>
                </div>
                {n.unread ? (
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                ) : null}
              </li>
            ))}
            {view.length === 0 ? (
              <li className="px-3 py-10 text-center text-sm text-muted-foreground">
                You&apos;re all caught up.
              </li>
            ) : null}
          </ul>
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <Link
              href="/dashboard/settings/notifications"
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Notification settings
            </Link>
            <span className="text-[11px] text-muted-foreground">Preview data</span>
          </div>
        </div>
      )}
    </DashboardPopover>
  );
}
