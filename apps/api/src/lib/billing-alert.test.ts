import { describe, expect, it } from "vitest";
import { billingAlertVariant, billingHealthFromPlanContext } from "./billing-alert.js";

describe("billingAlertVariant", () => {
  it("returns null for empty or unknown", () => {
    expect(billingAlertVariant(null)).toBeNull();
    expect(billingAlertVariant("")).toBeNull();
    expect(billingAlertVariant("active")).toBeNull();
  });

  it("maps Stripe statuses", () => {
    expect(billingAlertVariant("past_due")).toBe("past_due");
    expect(billingAlertVariant("PAST_DUE")).toBe("past_due");
    expect(billingAlertVariant("unpaid")).toBe("unpaid");
    expect(billingAlertVariant("canceled")).toBe("canceled");
    expect(billingAlertVariant("incomplete")).toBe("incomplete");
    expect(billingAlertVariant("INCOMPLETE_EXPIRED")).toBe("incomplete_expired");
  });
});

describe("billingHealthFromPlanContext", () => {
  it("includes Stripe customer and period end from org plan context", () => {
    const health = billingHealthFromPlanContext({
      stripeSubscriptionStatus: "active",
      stripeCurrentPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
      storedPlanTier: "PRO",
      planTier: "PRO",
      stripeCustomerId: "cus_123",
    });
    expect(health.hasStripeCustomer).toBe(true);
    expect(health.effectivePlanTier).toBe("PRO");
    expect(health.stripeCurrentPeriodEnd).toBe("2026-06-01T00:00:00.000Z");
    expect(health.billingAlertVariant).toBeNull();
  });
});
