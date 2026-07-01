import { describe, expect, it } from "vitest";
import {
  dedupeNotificationItems,
  type DashboardNotificationItem,
} from "./dashboard-notifications.js";

describe("dedupeNotificationItems", () => {
  it("prefers quota over alert when notification ids collide", () => {
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

    expect(dedupeNotificationItems([alert, quota])).toEqual([quota]);
    expect(dedupeNotificationItems([quota, alert])).toEqual([quota]);
  });
});
