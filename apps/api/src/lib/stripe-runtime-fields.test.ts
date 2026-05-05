import { describe, expect, it } from "vitest";
import { stripeSubscriptionPeriodEndUnix } from "./stripe-runtime-fields.js";

describe("stripeSubscriptionPeriodEndUnix", () => {
  it("reads current_period_end when present", () => {
    expect(stripeSubscriptionPeriodEndUnix({ current_period_end: 1_700_000_000 })).toBe(
      1_700_000_000
    );
    expect(stripeSubscriptionPeriodEndUnix({})).toBeNull();
  });
});
