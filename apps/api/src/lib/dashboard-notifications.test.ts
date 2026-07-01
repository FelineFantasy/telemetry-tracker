import { describe, expect, it } from "vitest";
import { buildDashboardNotifications } from "./dashboard-notifications.js";
import type { DashboardSessionContextPayload } from "./dashboard-session-context.js";

const baseSession: DashboardSessionContextPayload = {
  projectId: "p1",
  role: "OWNER",
  canResolveErrors: true,
  canCreateApiKey: true,
  canRevokeApiKey: true,
  canCreateProject: true,
  canManageMembers: true,
  canArchiveOrganization: true,
  canArchiveProject: true,
  usageQuota: null,
  billingHealth: null,
};

describe("buildDashboardNotifications", () => {
  it("includes billing and quota items", async () => {
    const prisma = {
      errorGroup: { findMany: async () => [] },
    } as never;

    const items = await buildDashboardNotifications(prisma, "p1", {
      ...baseSession,
      billingHealth: {
        organizationId: "org-1",
        stripeSubscriptionStatus: "past_due",
        stripeCurrentPeriodEnd: "2026-07-01T00:00:00.000Z",
        storedPlanTier: "PRO",
        effectivePlanTier: "PRO",
        hasStripeCustomer: true,
        billingAlertVariant: "past_due",
      },
      usageQuota: {
        planTier: "PRO",
        monthlyIngestUsed: 950,
        monthlyIngestLimit: 1000,
        percentUsed: 95,
        quotaExceeded: false,
        nearQuota: true,
        retentionDays: 30,
      },
    });

    expect(items.some((i) => i.id === "billing:past_due:org-1:2026-07-01")).toBe(true);
    expect(items.some((i) => i.id.startsWith("quota:near:p1:"))).toBe(true);
  });

  it("includes unresolved error groups for the project", async () => {
    const prisma = {
      errorGroup: {
        findMany: async () => [
          {
            id: "eg1",
            message: "TypeError: x is not a function",
            app: "web",
            environment: "production",
            occurrences: 12,
            last_seen: new Date("2026-07-01T10:00:00.000Z"),
          },
        ],
      },
    } as never;

    const items = await buildDashboardNotifications(prisma, "p1", baseSession);
    const issue = items.find((i) => i.id === "issue:eg1");
    expect(issue?.type).toBe("issue");
    expect(issue?.href).toBe("/dashboard/errors/eg1");
  });
});
