import { describe, expect, it } from "vitest";
import { quotaNotificationKey } from "./quota-notification-keys.js";

describe("quotaNotificationKey", () => {
  it("scopes near and exceeded keys by project and billing month", () => {
    expect(quotaNotificationKey("project-a", "near", "2026-03")).toBe(
      "quota:near:project-a:2026-03"
    );
    expect(quotaNotificationKey("project-b", "exceeded", "2026-03")).toBe(
      "quota:exceeded:project-b:2026-03"
    );
  });

  it("uses distinct keys for different projects in the same month", () => {
    const month = "2026-07";
    expect(quotaNotificationKey("p1", "near", month)).not.toBe(
      quotaNotificationKey("p2", "near", month)
    );
  });
});
