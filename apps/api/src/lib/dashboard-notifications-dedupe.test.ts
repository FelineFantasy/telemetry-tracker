import { describe, expect, it } from "vitest";
import {
  dedupeNotificationItems,
  type DashboardNotificationItem,
} from "./dashboard-notifications.js";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "./notification-preferences.js";

const quota: DashboardNotificationItem = {
  id: "quota:near:p1:2026-07",
  type: "quota",
  title: "Usage approaching limit",
  body: "session quota",
  occurredAt: "2026-07-01T10:00:00.000Z",
  href: "/dashboard/settings/billing",
};

const alert: DashboardNotificationItem = {
  id: "quota:near:p1:2026-07",
  type: "alert",
  title: "Usage approaching limit",
  body: "fired alert",
  occurredAt: "2026-07-01T12:00:00.000Z",
  href: "/dashboard/settings/billing",
};

describe("dedupeNotificationItems", () => {
  it("prefers quota when only billing in-app routing is enabled", () => {
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      routing: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.routing,
        billing: { inapp: true, email: true },
        alerts: { inapp: false, email: false },
      },
    };

    expect(dedupeNotificationItems([alert, quota], prefs)).toEqual([quota]);
    expect(dedupeNotificationItems([quota, alert], prefs)).toEqual([quota]);
  });

  it("prefers alert when only alerts in-app routing is enabled", () => {
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      routing: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.routing,
        billing: { inapp: false, email: true },
        alerts: { inapp: true, email: true },
      },
    };

    expect(dedupeNotificationItems([alert, quota], prefs)).toEqual([alert]);
    expect(dedupeNotificationItems([quota, alert], prefs)).toEqual([alert]);
  });
});
