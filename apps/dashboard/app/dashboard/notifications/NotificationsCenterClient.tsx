"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  markAllNotificationsReadAction,
  markNotificationsReadAction,
  setDashboardProjectId,
} from "@/app/dashboard/actions";
import {
  NotificationTypeIcon,
  NOTIFICATION_TYPE_LABELS,
} from "@/app/components/dashboard/NotificationTypeIcon";
import {
  SettingsPageBody,
  SettingsPageHeader,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import {
  FilterField,
  FilterLabel,
  FilterRow,
} from "@/app/components/dashboard/list-filters-ui";
import { filterInputClassName } from "@/lib/input-classes";
import { cn } from "@/lib/utils";
import type {
  DashboardNotificationItem,
  NotificationProjectOption,
} from "@/lib/dashboard-notifications";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/format-time";
import { groupNotificationsByDay } from "@/lib/notification-day-groups";
import {
  useDashboardNavigation,
  useDashboardNavLinkProps,
} from "@/lib/use-dashboard-navigation";

const TYPE_FILTERS = [
  { value: "", label: "All types" },
  { value: "issue", label: NOTIFICATION_TYPE_LABELS.issue },
  { value: "alert", label: NOTIFICATION_TYPE_LABELS.alert },
  { value: "quota", label: NOTIFICATION_TYPE_LABELS.quota },
  { value: "billing", label: NOTIFICATION_TYPE_LABELS.billing },
  { value: "team", label: NOTIFICATION_TYPE_LABELS.team },
] as const;

type Props = {
  initialItems: DashboardNotificationItem[];
  projects: NotificationProjectOption[];
  initialType: string;
  initialProjectId: string;
  initialUnreadOnly: boolean;
  currentProjectId: string;
  currentOrganizationId: string | null;
};

export function NotificationsCenterClient({
  initialItems,
  projects,
  initialType,
  initialProjectId,
  initialUnreadOnly,
  currentProjectId,
  currentOrganizationId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { replaceAndRefresh, runPending } = useDashboardNavigation();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState(initialItems);
  const [type, setType] = useState(initialType);
  const [projectId, setProjectId] = useState(initialProjectId);
  const [unreadOnly, setUnreadOnly] = useState(initialUnreadOnly);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setType(initialType);
    setProjectId(initialProjectId);
    setUnreadOnly(initialUnreadOnly);
  }, [initialType, initialProjectId, initialUnreadOnly]);

  const applyFilters = useCallback(
    (next: { type?: string; projectId?: string; unreadOnly?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      const nextType = next.type ?? type;
      const nextProject = next.projectId ?? projectId;
      const nextUnread = next.unreadOnly ?? unreadOnly;

      if (nextType) params.set("type", nextType);
      else params.delete("type");
      if (nextProject) params.set("projectId", nextProject);
      else params.delete("projectId");
      if (nextUnread) params.set("unread", "1");
      else params.delete("unread");

      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [pathname, projectId, router, searchParams, type, unreadOnly]
  );

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
      void markAllNotificationsReadAction({ scope: "organization" }).then(
        (result) => {
          if (!result.ok) {
            setItems((current) =>
              current.map((item) =>
                unreadIds.includes(item.id) ? { ...item, unread: true } : item
              )
            );
            toast.error(result.error || "Could not mark notifications as read");
            return;
          }
          router.refresh();
        }
      );
      return prev.map((item) => ({ ...item, unread: false }));
    });
  }, [router]);

  const openNotification = useCallback(
    async (item: DashboardNotificationItem) => {
      markRead(item.id);
      const href = item.href;
      if (!href) return;

      const targetProjectId = item.projectId?.trim() || "";
      const needsProjectSwitch =
        Boolean(targetProjectId) &&
        targetProjectId.toLowerCase() !== currentProjectId.toLowerCase();

      if (!needsProjectSwitch) {
        router.push(href);
        return;
      }

      await runPending(async () => {
        const result = await setDashboardProjectId(targetProjectId);
        if (!result.ok) {
          toast.error(result.error || "Could not switch project");
          router.push(href);
          return;
        }
        await replaceAndRefresh(href, {
          organizationId: currentOrganizationId,
          projectId: targetProjectId,
        });
      });
    },
    [
      currentOrganizationId,
      currentProjectId,
      markRead,
      replaceAndRefresh,
      router,
      runPending,
    ]
  );

  const groups = useMemo(() => groupNotificationsByDay(items), [items]);
  const unreadCount = items.filter((item) => item.unread).length;

  return (
    <>
      <SettingsPageHeader
        title="Notifications"
        description="Project and organization events in one place — issues, alerts, billing, quota, and team updates."
        actions={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="h-9 rounded-md border border-border bg-transparent px-3 text-[13px] font-medium text-muted-foreground hover:bg-surface/60 hover:text-foreground"
            >
              Mark all read
            </button>
          ) : null
        }
      />
      <SettingsPageBody>
        <div className="mb-6 space-y-3 border-b border-border pb-4">
          <FilterRow>
            <FilterField>
              <FilterLabel>Type</FilterLabel>
              <select
                className={cn(filterInputClassName, "w-full min-w-[10rem]")}
                value={type}
                disabled={pending}
                onChange={(e) => {
                  const value = e.target.value;
                  setType(value);
                  applyFilters({ type: value });
                }}
              >
                {TYPE_FILTERS.map((opt) => (
                  <option key={opt.value || "all"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField>
              <FilterLabel>Project</FilterLabel>
              <select
                className={cn(filterInputClassName, "w-full min-w-[12rem]")}
                value={projectId}
                disabled={pending}
                onChange={(e) => {
                  const value = e.target.value;
                  setProjectId(value);
                  applyFilters({ projectId: value });
                }}
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField>
              <FilterLabel>Status</FilterLabel>
              <div className="inline-flex h-9 divide-x divide-border overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setUnreadOnly(false);
                    applyFilters({ unreadOnly: false });
                  }}
                  className={cn(
                    "px-3 text-[13px]",
                    !unreadOnly
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-surface/60"
                  )}
                >
                  All
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setUnreadOnly(true);
                    applyFilters({ unreadOnly: true });
                  }}
                  className={cn(
                    "px-3 text-[13px]",
                    unreadOnly
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-surface/60"
                  )}
                >
                  Unread
                </button>
              </div>
            </FilterField>
          </FilterRow>
          <p className="text-[12px] text-muted-foreground">
            {pending
              ? "Updating…"
              : unreadCount > 0
                ? `${unreadCount} unread · ${items.length} shown`
                : `${items.length} notification${items.length === 1 ? "" : "s"}`}
            {" · "}
            <NotificationSettingsInlineLink />
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {unreadOnly
                ? "You're all caught up."
                : "No notifications match these filters."}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`notif-day-${group.key}`}>
                <h2
                  id={`notif-day-${group.key}`}
                  className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {group.label}
                </h2>
                <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                  {group.items.map((n) => (
                    <NotificationCenterRow
                      key={n.id}
                      item={n}
                      onOpen={openNotification}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </SettingsPageBody>
    </>
  );
}

function NotificationSettingsInlineLink() {
  const linkProps = useDashboardNavLinkProps("/dashboard/settings/notifications");
  return (
    <Link {...linkProps} className="text-brand hover:underline">
      Notification settings
    </Link>
  );
}

function NotificationCenterRow({
  item,
  onOpen,
}: {
  item: DashboardNotificationItem;
  onOpen: (item: DashboardNotificationItem) => void;
}) {
  const content = (
    <>
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-background">
        <NotificationTypeIcon type={item.type} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
          <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug">
            {item.title}
          </p>
          <span
            className="shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground"
            title={formatAbsoluteTime(item.occurredAt)}
          >
            {formatRelativeTime(item.occurredAt)}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{item.body}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-md bg-surface px-1.5 py-0.5">
            {NOTIFICATION_TYPE_LABELS[item.type]}
          </span>
          {item.projectName ? (
            <span className="rounded-md bg-surface px-1.5 py-0.5">
              {item.projectName}
            </span>
          ) : null}
        </div>
      </div>
      {item.unread ? (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />
      ) : (
        <span className="mt-2 h-2 w-2 shrink-0" aria-hidden />
      )}
    </>
  );

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={cn(
          "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/60",
          item.unread ? "bg-brand-soft/20" : "bg-background"
        )}
      >
        {content}
      </button>
    </li>
  );
}
