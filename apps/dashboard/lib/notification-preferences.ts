import { dashboardApiFetch } from "@/lib/dashboard-api";

export type NotificationCategory = "issues" | "billing" | "team";
export type NotificationChannel = "inapp" | "email";

export type NotificationPreferences = {
  channels: Record<NotificationChannel, boolean>;
  routing: Record<
    NotificationCategory,
    Record<NotificationChannel, boolean>
  >;
  quietHours: {
    enabled: boolean;
    startHour: number;
    endHour: number;
    timezone: string;
  };
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  channels: { inapp: true, email: false },
  routing: {
    issues: { inapp: true, email: false },
    billing: { inapp: true, email: true },
    team: { inapp: true, email: true },
  },
  quietHours: {
    enabled: false,
    startHour: 22,
    endHour: 7,
    timezone: "UTC",
  },
};

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await dashboardApiFetch("/api/meta/notification-preferences");
  if (!res.ok) return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const data = (await res.json()) as { preferences?: unknown };
    return parseNotificationPreferences(data.preferences);
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export function parseNotificationPreferences(raw: unknown): NotificationPreferences {
  if (typeof raw !== "object" || raw === null) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
  const o = raw as Record<string, unknown>;
  const channels = o.channels;
  const routing = o.routing;
  const quietHours = o.quietHours;
  if (
    typeof channels !== "object" ||
    channels === null ||
    typeof routing !== "object" ||
    routing === null ||
    typeof quietHours !== "object" ||
    quietHours === null
  ) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  const ch = channels as Record<string, unknown>;
  const rt = routing as Record<string, unknown>;
  const qh = quietHours as Record<string, unknown>;

  function route(cat: NotificationCategory): Record<NotificationChannel, boolean> | null {
    const row = rt[cat];
    if (typeof row !== "object" || row === null) return null;
    const r = row as Record<string, unknown>;
    if (typeof r.inapp !== "boolean" || typeof r.email !== "boolean") return null;
    return { inapp: r.inapp, email: r.email };
  }

  const issues = route("issues");
  const billing = route("billing");
  const team = route("team");

  if (
    typeof ch.inapp !== "boolean" ||
    typeof ch.email !== "boolean" ||
    !issues ||
    !billing ||
    !team ||
    typeof qh.enabled !== "boolean" ||
    typeof qh.startHour !== "number" ||
    typeof qh.endHour !== "number" ||
    typeof qh.timezone !== "string"
  ) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  return {
    channels: { inapp: ch.inapp, email: ch.email },
    routing: { issues, billing, team },
    quietHours: {
      enabled: qh.enabled,
      startHour: qh.startHour,
      endHour: qh.endHour,
      timezone: qh.timezone,
    },
  };
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function preferencesEqual(
  a: NotificationPreferences,
  b: NotificationPreferences
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
