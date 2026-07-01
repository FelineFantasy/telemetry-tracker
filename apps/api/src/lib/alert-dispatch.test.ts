import { describe, expect, it } from "vitest";
import { alertEventHref, recentAlertNotifications } from "./alert-dispatch.js";

describe("alertEventHref", () => {
  it("uses stored href when present", () => {
    expect(alertEventHref("ERROR_SPIKE", "/dashboard/errors/eg-1")).toBe(
      "/dashboard/errors/eg-1"
    );
  });

  it("falls back by rule for legacy rows without href", () => {
    expect(alertEventHref("ERROR_SPIKE", null)).toBe("/dashboard/errors");
    expect(alertEventHref("QUOTA_NEAR", null)).toBe("/dashboard/settings/billing");
    expect(alertEventHref("QUOTA_EXCEEDED", null)).toBe("/dashboard/settings/billing");
  });
});

describe("recentAlertNotifications", () => {
  it("includes quota near and exceeded events in the bell feed", async () => {
    const prisma = {
      alertEvent: {
        findMany: async () => [
          {
            rule: "QUOTA_NEAR",
            title: "Usage approaching limit",
            body: "85%",
            href: "/dashboard/settings/billing",
            dedupe_key: "quota:near:p1:2026-07",
            fired_at: new Date("2026-07-01T11:00:00.000Z"),
          },
          {
            rule: "ERROR_SPIKE",
            title: "Error spike detected",
            body: "50 errors",
            href: "/dashboard/errors",
            dedupe_key: "alert:error_spike:p1:15:1",
            fired_at: new Date("2026-07-01T10:00:00.000Z"),
          },
        ],
      },
    } as never;

    const items = await recentAlertNotifications(prisma, "p1");
    expect(items.map((i) => i.type)).toEqual(["alert", "alert"]);
    expect(items.some((i) => i.id.startsWith("quota:near:"))).toBe(true);
    expect(items.some((i) => i.id.startsWith("alert:error_spike:"))).toBe(true);
  });
});
