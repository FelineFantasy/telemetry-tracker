import { dashboardApiFetch, type DashboardApiFetchOptions } from "@/lib/dashboard-api";

export type DashboardNotificationItem = {
  id: string;
  type: "issue" | "billing" | "quota" | "team" | "alert";
  title: string;
  body: string;
  occurredAt: string;
  href: string | null;
  unread: boolean;
  projectId?: string | null;
  projectName?: string | null;
};

export type NotificationProjectOption = {
  id: string;
  name: string;
};

export type FetchDashboardNotificationsOptions = Pick<
  DashboardApiFetchOptions,
  "projectIdOverride" | "organizationIdOverride"
> & {
  scope?: "project" | "organization";
  type?: string | null;
  projectId?: string | null;
  unreadOnly?: boolean;
};

export type DashboardNotificationsPayload = {
  items: DashboardNotificationItem[];
  projects: NotificationProjectOption[];
  scope: "project" | "organization";
};

export async function fetchDashboardNotifications(
  options?: FetchDashboardNotificationsOptions
): Promise<DashboardNotificationItem[]> {
  const payload = await fetchDashboardNotificationsPayload(options);
  return payload.items;
}

export async function fetchDashboardNotificationsPayload(
  options?: FetchDashboardNotificationsOptions
): Promise<DashboardNotificationsPayload> {
  const params = new URLSearchParams();
  if (options?.scope === "organization") params.set("scope", "organization");
  if (options?.type) params.set("type", options.type);
  if (options?.projectId) params.set("projectId", options.projectId);
  if (options?.unreadOnly) params.set("unread", "1");
  const qs = params.toString();
  const path = qs ? `/api/meta/notifications?${qs}` : "/api/meta/notifications";

  const res = await dashboardApiFetch(path, undefined, {
    projectIdOverride: options?.projectIdOverride,
    organizationIdOverride: options?.organizationIdOverride,
  });
  if (!res.ok) {
    return { items: [], projects: [], scope: options?.scope ?? "project" };
  }
  try {
    const data = (await res.json()) as {
      items?: unknown;
      projects?: unknown;
      scope?: unknown;
    };
    const items = Array.isArray(data.items)
      ? data.items.filter(isNotificationItem)
      : [];
    const projects = Array.isArray(data.projects)
      ? data.projects.filter(isProjectOption)
      : [];
    const scope = data.scope === "organization" ? "organization" : "project";
    return { items, projects, scope };
  } catch {
    return { items: [], projects: [], scope: options?.scope ?? "project" };
  }
}

function isProjectOption(value: unknown): value is NotificationProjectOption {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.name === "string";
}

function isNotificationItem(value: unknown): value is DashboardNotificationItem {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    (o.type === "issue" ||
      o.type === "billing" ||
      o.type === "quota" ||
      o.type === "team" ||
      o.type === "alert") &&
    typeof o.title === "string" &&
    typeof o.body === "string" &&
    typeof o.occurredAt === "string" &&
    typeof o.unread === "boolean" &&
    (o.href === null || typeof o.href === "string") &&
    (o.projectId === undefined ||
      o.projectId === null ||
      typeof o.projectId === "string") &&
    (o.projectName === undefined ||
      o.projectName === null ||
      typeof o.projectName === "string")
  );
}
