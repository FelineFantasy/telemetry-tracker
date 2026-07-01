import { z } from "zod";
import type { DashboardNotificationItem } from "./dashboard-notifications.js";

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

const hourSchema = z.number().int().min(0).max(23);

const preferencesSchema = z.object({
  channels: z.object({
    inapp: z.boolean(),
    email: z.boolean(),
  }),
  routing: z.object({
    issues: z.object({ inapp: z.boolean(), email: z.boolean() }),
    billing: z.object({ inapp: z.boolean(), email: z.boolean() }),
    team: z.object({ inapp: z.boolean(), email: z.boolean() }),
  }),
  quietHours: z.object({
    enabled: z.boolean(),
    startHour: hourSchema,
    endHour: hourSchema,
    timezone: z.string().min(1).max(64),
  }),
});

export function parseNotificationPreferences(
  raw: unknown
): NotificationPreferences {
  const parsed = preferencesSchema.safeParse(raw);
  if (!parsed.success) {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
  return parsed.data;
}

export function validateNotificationPreferencesPatch(
  body: unknown
): { ok: true; preferences: NotificationPreferences } | { ok: false; error: string } {
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Invalid notification preferences payload" };
  }
  return { ok: true, preferences: parsed.data };
}

export function categoryForNotificationType(
  type: DashboardNotificationItem["type"]
): NotificationCategory {
  if (type === "issue") return "issues";
  if (type === "team") return "team";
  return "billing";
}

export function isCriticalInAppNotification(
  item: DashboardNotificationItem
): boolean {
  return item.type === "billing" || item.type === "quota";
}

export function shouldSendEmailForCategory(
  prefs: NotificationPreferences,
  category: NotificationCategory
): boolean {
  if (!prefs.channels.email) return false;
  return prefs.routing[category].email;
}

/** Hour (0–23) in the given IANA timezone; falls back to UTC. */
export function currentHourInTimezone(timezone: string, now = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour");
    const hour = hourPart ? Number(hourPart.value) : Number.NaN;
    if (Number.isFinite(hour)) {
      return hour === 24 ? 0 : hour;
    }
  } catch {
    /* invalid timezone */
  }
  return now.getUTCHours();
}

export function isInQuietHours(
  prefs: NotificationPreferences,
  now = new Date()
): boolean {
  if (!prefs.quietHours.enabled) return false;
  const hour = currentHourInTimezone(prefs.quietHours.timezone, now);
  const { startHour, endHour } = prefs.quietHours;
  if (startHour === endHour) return false;
  if (startHour < endHour) {
    return hour >= startHour && hour < endHour;
  }
  return hour >= startHour || hour < endHour;
}

export function shouldShowInAppNotification(
  item: DashboardNotificationItem,
  prefs: NotificationPreferences,
  now = new Date()
): boolean {
  if (!prefs.channels.inapp) return false;

  const category = categoryForNotificationType(item.type);
  if (!prefs.routing[category].inapp) return false;

  if (
    isInQuietHours(prefs, now) &&
    !isCriticalInAppNotification(item)
  ) {
    return false;
  }

  return true;
}

export function filterInAppNotifications(
  items: DashboardNotificationItem[],
  prefs: NotificationPreferences,
  now = new Date()
): DashboardNotificationItem[] {
  return items.filter((item) => shouldShowInAppNotification(item, prefs, now));
}
