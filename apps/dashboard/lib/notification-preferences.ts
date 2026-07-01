import { dashboardApiFetch } from "@/lib/dashboard-api";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  parseNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/notification-preferences-shared";

export type {
  NotificationCategory,
  NotificationChannel,
  NotificationPreferences,
} from "@/lib/notification-preferences-shared";

export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  browserTimezone,
  parseNotificationPreferences,
  preferencesEqual,
} from "@/lib/notification-preferences-shared";

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
