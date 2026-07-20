import { beforeEach, describe, expect, it, vi } from "vitest";

const organizationFindFirst = vi.fn();
const projectFindFirst = vi.fn();

vi.mock("./db.js", () => ({
  prisma: {
    organization: {
      findFirst: (...args: unknown[]) => organizationFindFirst(...args),
    },
    project: {
      findFirst: (...args: unknown[]) => projectFindFirst(...args),
    },
  },
}));

import {
  loadPlanContextForOrganization,
  loadPlanContextForProject,
} from "./plan-enforcement.js";
import { prisma } from "./db.js";

describe("loadPlanContextForOrganization", () => {
  beforeEach(() => {
    organizationFindFirst.mockReset();
    projectFindFirst.mockReset();
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

describe("loadPlanContextForProject", () => {
  beforeEach(() => {
    organizationFindFirst.mockReset();
    projectFindFirst.mockReset();
  });

  it("loads plan context via organization_id without nesting the required relation", async () => {
    projectFindFirst.mockResolvedValue({ organization_id: "org-1" });
    organizationFindFirst.mockResolvedValue({
      plan_tier: "FREE",
      stripe_customer_id: null,
      stripe_subscription_status: null,
      stripe_current_period_end: null,
    });

    const ctx = await loadPlanContextForProject(prisma, "project-1");

    expect(projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "project-1",
          deleted_at: null,
          organization: { deleted_at: null },
        },
        select: { organization_id: true },
      })
    );
    expect(ctx).toMatchObject({
      organizationId: "org-1",
      planTier: "FREE",
    });
  });

  it("returns null when the project is missing or org is soft-deleted", async () => {
    projectFindFirst.mockResolvedValue(null);
    await expect(loadPlanContextForProject(prisma, "project-missing")).resolves.toBeNull();
    expect(organizationFindFirst).not.toHaveBeenCalled();
  });

  it("returns null when the organization row is gone after project lookup", async () => {
    projectFindFirst.mockResolvedValue({ organization_id: "org-gone" });
    organizationFindFirst.mockResolvedValue(null);
    await expect(loadPlanContextForProject(prisma, "project-1")).resolves.toBeNull();
  });
});
