import { dashboardApiFetch, type DashboardApiFetchOptions } from "@/lib/dashboard-api";

export type DashboardNotificationItem = {
  id: string;
  type: "issue" | "billing" | "quota" | "team";
  title: string;
  body: string;
  occurredAt: string;
  href: string | null;
  unread: boolean;
};

export async function fetchDashboardNotifications(
  options?: Pick<DashboardApiFetchOptions, "projectIdOverride" | "organizationIdOverride">
): Promise<DashboardNotificationItem[]> {
  const res = await dashboardApiFetch(
    "/api/meta/notifications",
    undefined,
    options
  );
  if (!res.ok) return [];
  try {
    const data = (await res.json()) as { items?: unknown };
    if (!Array.isArray(data.items)) return [];
    return data.items.filter(isNotificationItem);
  } catch {
    return [];
  }
}

function isNotificationItem(value: unknown): value is DashboardNotificationItem {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.type === "issue" ||
      o.type === "billing" ||
      o.type === "quota" ||
      o.type === "team") &&
    typeof o.title === "string" &&
    typeof o.body === "string" &&
    typeof o.occurredAt === "string" &&
    typeof o.unread === "boolean" &&
    (o.href === null || typeof o.href === "string")
  );
}
