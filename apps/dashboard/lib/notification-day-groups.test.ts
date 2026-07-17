import { describe, expect, it } from "vitest";
import {
  groupNotificationsByDay,
  notificationDayLabel,
} from "./notification-day-groups";
import type { DashboardNotificationItem } from "./dashboard-notifications";

function item(id: string, occurredAt: string): DashboardNotificationItem {
  return {
    id,
    type: "issue",
    title: id,
    body: "body",
    occurredAt,
    href: null,
    unread: true,
  };
}

describe("notificationDayLabel", () => {
  it("labels today and yesterday in local time", () => {
    const now = new Date(2026, 6, 17, 15, 0, 0);
    const todayIso = new Date(2026, 6, 17, 10, 0, 0).toISOString();
    const yesterdayIso = new Date(2026, 6, 16, 10, 0, 0).toISOString();
    expect(notificationDayLabel(todayIso, now)).toBe("Today");
    expect(notificationDayLabel(yesterdayIso, now)).toBe("Yesterday");
  });
});

describe("groupNotificationsByDay", () => {
  it("groups items under day labels", () => {
    const now = new Date(2026, 6, 17, 15, 0, 0);
    const groups = groupNotificationsByDay(
      [
        item("a", new Date(2026, 6, 17, 12, 0, 0).toISOString()),
        item("b", new Date(2026, 6, 17, 8, 0, 0).toISOString()),
        item("c", new Date(2026, 6, 16, 12, 0, 0).toISOString()),
      ],
      now
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]!.label).toBe("Today");
    expect(groups[0]!.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(groups[1]!.label).toBe("Yesterday");
    expect(groups[1]!.items.map((i) => i.id)).toEqual(["c"]);
  });
});
