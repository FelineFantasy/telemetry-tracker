import { describe, expect, it } from "vitest";
import type { DashboardNotificationItem } from "./dashboard-notifications.js";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  filterInAppNotifications,
  filterInAppNotificationsForReadPersistence,
  isInQuietHours,
  parseNotificationPreferences,
  shouldShowInAppNotification,
} from "./notification-preferences.js";

const issue: DashboardNotificationItem = {
  id: "issue:1",
  type: "issue",
  title: "Error",
  body: "body",
  occurredAt: new Date().toISOString(),
  href: "/dashboard/errors/1",
};

const billing: DashboardNotificationItem = {
  id: "billing:past_due",
  type: "billing",
  title: "Payment past due",
  body: "body",
  occurredAt: new Date().toISOString(),
  href: "/dashboard/settings/billing",
};

describe("notification-preferences", () => {
  it("returns defaults for invalid stored JSON", () => {
    expect(parseNotificationPreferences(null)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(parseNotificationPreferences({ channels: {} })).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
  });

  it("filters issues when in-app routing is disabled", () => {
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      routing: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.routing,
        issues: { inapp: false, email: false },
      },
    };
    expect(filterInAppNotifications([issue, billing], prefs)).toEqual([billing]);
  });

  it("hides non-critical notifications during quiet hours", () => {
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quietHours: {
        enabled: true,
        startHour: 0,
        endHour: 24,
        timezone: "UTC",
      },
    };
    const noon = new Date("2026-07-01T12:00:00.000Z");
    expect(shouldShowInAppNotification(issue, prefs, noon)).toBe(false);
    expect(shouldShowInAppNotification(billing, prefs, noon)).toBe(true);
  });

  it("detects quiet hours spanning midnight", () => {
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quietHours: {
        enabled: true,
        startHour: 22,
        endHour: 7,
        timezone: "UTC",
      },
    };
    expect(isInQuietHours(prefs, new Date("2026-07-01T23:00:00.000Z"))).toBe(true);
    expect(isInQuietHours(prefs, new Date("2026-07-01T12:00:00.000Z"))).toBe(false);
  });

  it("keeps quiet-hours-hidden items for mark-all-read persistence", () => {
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quietHours: {
        enabled: true,
        startHour: 0,
        endHour: 24,
        timezone: "UTC",
      },
    };
    expect(filterInAppNotifications([issue, billing], prefs)).toEqual([billing]);
    expect(filterInAppNotificationsForReadPersistence([issue, billing], prefs)).toEqual([
      issue,
      billing,
    ]);
  });
});
