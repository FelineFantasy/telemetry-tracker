import { describe, expect, it } from "vitest";
import { PlanTier } from "@prisma/client";
import { effectivePlanTierForLimits } from "./effective-plan-tier.js";

describe("effectivePlanTierForLimits", () => {
  it("uses stored tier when Stripe status is absent", () => {
    expect(effectivePlanTierForLimits(PlanTier.PRO, null)).toBe(PlanTier.PRO);
    expect(effectivePlanTierForLimits(PlanTier.PRO, undefined)).toBe(PlanTier.PRO);
    expect(effectivePlanTierForLimits(PlanTier.PRO, "")).toBe(PlanTier.PRO);
  });

  it("keeps paid tier for active and past_due", () => {
    expect(effectivePlanTierForLimits(PlanTier.PRO, "active")).toBe(PlanTier.PRO);
    expect(effectivePlanTierForLimits(PlanTier.BUSINESS, "trialing")).toBe(
      PlanTier.BUSINESS
    );
    expect(effectivePlanTierForLimits(PlanTier.PRO, "past_due")).toBe(PlanTier.PRO);
    expect(effectivePlanTierForLimits(PlanTier.PRO, "PAST_DUE")).toBe(PlanTier.PRO);
  });

  it("downgrades to FREE for canceled, unpaid, incomplete", () => {
    expect(effectivePlanTierForLimits(PlanTier.PRO, "canceled")).toBe(PlanTier.FREE);
    expect(effectivePlanTierForLimits(PlanTier.PRO, "unpaid")).toBe(PlanTier.FREE);
    expect(effectivePlanTierForLimits(PlanTier.PRO, "incomplete_expired")).toBe(
      PlanTier.FREE
    );
    expect(effectivePlanTierForLimits(PlanTier.BUSINESS, "incomplete")).toBe(
      PlanTier.FREE
    );
  });
});
