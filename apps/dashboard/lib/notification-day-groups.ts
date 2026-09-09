import type { DashboardNotificationItem } from "@/lib/dashboard-notifications";

export type NotificationDayGroup = {
  key: string;
  label: string;
  items: DashboardNotificationItem[];
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function notificationDayLabel(iso: string, now = new Date()): string {
  const occurred = new Date(iso);
  if (Number.isNaN(occurred.getTime())) return "Earlier";

  const today = startOfLocalDay(now);
  const day = startOfLocalDay(occurred);
  const diffDays = Math.round((today.getTime() - day.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return day.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: day.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

export function sortNotificationsNewestFirst(
  items: DashboardNotificationItem[]
): DashboardNotificationItem[] {
  return [...items].sort((a, b) => {
    const aTime = new Date(a.occurredAt).getTime();
    const bTime = new Date(b.occurredAt).getTime();
    const aOk = Number.isFinite(aTime) ? aTime : 0;
    const bOk = Number.isFinite(bTime) ? bTime : 0;
    return bOk - aOk;
  });
}

/** Group notifications by calendar day (newest groups and items first). */
export function groupNotificationsByDay(
  items: DashboardNotificationItem[],
  now = new Date()
): NotificationDayGroup[] {
  const groups: NotificationDayGroup[] = [];
  const indexByKey = new Map<string, number>();

  for (const item of sortNotificationsNewestFirst(items)) {
    const occurred = new Date(item.occurredAt);
    const day = Number.isNaN(occurred.getTime())
      ? "invalid"
      : startOfLocalDay(occurred).toISOString();
    const existing = indexByKey.get(day);
    if (existing !== undefined) {
      groups[existing]!.items.push(item);
      continue;
    }
    indexByKey.set(day, groups.length);
    groups.push({
      key: day,
      label: notificationDayLabel(item.occurredAt, now),
      items: [item],
    });
  }

  return groups;
}
