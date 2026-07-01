import { describe, expect, it } from "vitest";
import { billingNotificationKey } from "./billing-notification-keys.js";

describe("billingNotificationKey", () => {
  it("scopes billing alerts by org, variant, and Stripe period end", () => {
    expect(
      billingNotificationKey(
        "org-1",
        "past_due",
        new Date("2026-05-15T12:00:00.000Z")
      )
    ).toBe("billing:past_due:org-1:2026-05-15");
  });

  it("uses calendar month when period end is missing", () => {
    expect(billingNotificationKey("org-1", "canceled", null)).toMatch(
      /^billing:canceled:org-1:\d{4}-\d{2}$/
    );
  });
});
