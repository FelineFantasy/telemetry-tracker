import { describe, expect, it, vi, beforeEach } from "vitest";

const loadPlanContextForProject = vi.fn();
const getMonthlyIngestUsed = vi.fn();
const loadProjectAlertSettings = vi.fn();

vi.mock("./plan-enforcement.js", () => ({
  loadPlanContextForProject: (...args: unknown[]) => loadPlanContextForProject(...args),
  getMonthlyIngestUsed: (...args: unknown[]) => getMonthlyIngestUsed(...args),
}));

vi.mock("./error-spike-alert.js", () => ({
  loadProjectAlertSettings: (...args: unknown[]) => loadProjectAlertSettings(...args),
  quotaNearRatio: () => 0.8,
}));

import { buildOrganizationDashboardNotifications } from "./dashboard-notifications.js";
import type { DashboardSessionContextPayload } from "./dashboard-session-context.js";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "./notification-preferences.js";

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
  usageQuota: {
    planTier: "PRO",
    monthlyIngestUsed: 100,
    monthlyIngestLimit: 1000,
    percentUsed: 10,
    quotaExceeded: false,
    nearQuota: false,
    retentionDays: 30,
  },
  billingHealth: null,
};

describe("org-wide live quota for billing-only routing", () => {
  beforeEach(() => {
    loadPlanContextForProject.mockReset();
    getMonthlyIngestUsed.mockReset();
    loadProjectAlertSettings.mockReset();
    loadPlanContextForProject.mockImplementation(async (_prisma, projectId: string) => {
      if (projectId !== "p2") return null;
      return {
        organizationId: "org-1",
        storedPlanTier: "PRO",
        planTier: "PRO",
        stripeCustomerId: null,
        stripeSubscriptionStatus: null,
        stripeCurrentPeriodEnd: null,
        limits: { monthlyIngestUnits: 1000, retentionDays: 30 },
      };
    });
    getMonthlyIngestUsed.mockImplementation(async (_prisma, projectId: string) =>
      projectId === "p2" ? 900 : 0
    );
    loadProjectAlertSettings.mockResolvedValue({
      quota: { enabled: true, nearPercent: 80 },
      errorSpike: { enabled: true, threshold: 50, windowMinutes: 15 },
    });
  });

  it("keeps quota items for non-active projects when alerts in-app is off", async () => {
    const prisma = {
      alertEvent: {
        findMany: async () => [
          {
            project_id: "p2",
            rule: "QUOTA_NEAR",
            title: "Usage approaching limit",
            body: "fired",
            href: "/dashboard/settings/billing",
            dedupe_key: `quota:near:p2:${new Date().toISOString().slice(0, 7)}`,
            fired_at: new Date("2026-07-02T10:00:00.000Z"),
          },
        ],
      },
      errorGroup: { findMany: async () => [] },
    } as never;

    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      routing: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.routing,
        billing: { inapp: true, email: true },
        alerts: { inapp: false, email: false },
      },
    };

    const items = await buildOrganizationDashboardNotifications(
      prisma,
      [
        { id: "p1", name: "Alpha" },
        { id: "p2", name: "Beta" },
      ],
      "p1",
      baseSession,
      prefs
    );

    const yearMonth = new Date().toISOString().slice(0, 7);
    const quota = items.find((i) => i.id === `quota:near:p2:${yearMonth}`);
    expect(quota).toMatchObject({
      type: "quota",
      projectId: "p2",
      projectName: "Beta",
    });
    expect(items.some((i) => i.type === "alert")).toBe(false);
  });
});
