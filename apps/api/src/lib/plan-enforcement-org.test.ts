import { beforeEach, describe, expect, it, vi } from "vitest";

const organizationFindFirst = vi.fn();

vi.mock("./db.js", () => ({
  prisma: {
    organization: {
      findFirst: (...args: unknown[]) => organizationFindFirst(...args),
    },
  },
}));

import { loadPlanContextForOrganization } from "./plan-enforcement.js";
import { prisma } from "./db.js";

describe("loadPlanContextForOrganization", () => {
  beforeEach(() => {
    organizationFindFirst.mockReset();
  });

  it("loads org-level Stripe billing fields without a project", async () => {
    organizationFindFirst.mockResolvedValue({
      plan_tier: "PRO",
      stripe_customer_id: "cus_abc",
      stripe_subscription_status: "active",
      stripe_current_period_end: new Date("2026-06-01T00:00:00.000Z"),
    });

    const ctx = await loadPlanContextForOrganization(prisma, "org-1");

    expect(ctx).toMatchObject({
      organizationId: "org-1",
      storedPlanTier: "PRO",
      planTier: "PRO",
      stripeCustomerId: "cus_abc",
      stripeSubscriptionStatus: "active",
    });
  });

  it("returns null for missing organizations", async () => {
    organizationFindFirst.mockResolvedValue(null);
    await expect(loadPlanContextForOrganization(prisma, "org-missing")).resolves.toBeNull();
  });
});
