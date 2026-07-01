import { describe, expect, it, vi } from "vitest";
import type { DashboardNotificationItem } from "./dashboard-notifications.js";
import {
  attachNotificationReadState,
  markNotificationsRead,
} from "./notification-read.js";

const sampleItems: DashboardNotificationItem[] = [
  {
    id: "issue:1",
    type: "issue",
    title: "Error",
    body: "body",
    occurredAt: new Date().toISOString(),
    href: "/dashboard/errors/1",
  },
  {
    id: "billing:past_due",
    type: "billing",
    title: "Payment past due",
    body: "body",
    occurredAt: new Date().toISOString(),
    href: "/dashboard/settings/billing",
  },
];

describe("notification-read", () => {
  it("marks unread when id is not in read set", async () => {
    const prisma = {
      notificationRead: {
        findMany: vi.fn().mockResolvedValue([{ notification_id: "issue:1" }]),
      },
    };
    const result = await attachNotificationReadState(
      prisma as never,
      "user-1",
      sampleItems
    );
    expect(result[0]?.unread).toBe(false);
    expect(result[1]?.unread).toBe(true);
  });

  it("upserts read rows for each id", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const prisma = {
      $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
      notificationRead: { upsert },
    };
    await markNotificationsRead(prisma as never, "user-1", [
      "issue:1",
      "issue:1",
      "billing:past_due",
    ]);
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});
