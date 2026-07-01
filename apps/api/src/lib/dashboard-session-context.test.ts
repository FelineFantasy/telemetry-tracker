import { beforeEach, describe, expect, it, vi } from "vitest";

const loadPlanContextForProject = vi.fn();
const getMonthlyIngestUsed = vi.fn();
const loadProjectAlertSettings = vi.fn();
const getMembershipRoleForProject = vi.fn();
const getMembershipRoleForOrganization = vi.fn();

vi.mock("./plan-enforcement.js", () => ({
  loadPlanContextForProject: (...args: unknown[]) => loadPlanContextForProject(...args),
  getMonthlyIngestUsed: (...args: unknown[]) => getMonthlyIngestUsed(...args),
  loadPlanContextForOrganization: vi.fn(),
}));

vi.mock("./error-spike-alert.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./error-spike-alert.js")>();
  return {
    ...actual,
    loadProjectAlertSettings: (...args: unknown[]) => loadProjectAlertSettings(...args),
  };
});

vi.mock("./org-permissions.js", () => ({
  getMembershipRoleForProject: (...args: unknown[]) => getMembershipRoleForProject(...args),
  getMembershipRoleForOrganization: (...args: unknown[]) =>
    getMembershipRoleForOrganization(...args),
  canResolveErrors: () => true,
  canCreateApiKey: () => true,
  canRevokeApiKey: () => true,
  canCreateProject: () => true,
  canManageMembers: () => true,
  canArchiveOrganization: () => true,
  canArchiveProject: () => true,
}));

vi.mock("./read-project-request.js", () => ({
  tryResolveReadProjectId: async () => "p1",
}));

vi.mock("./http-headers.js", () => ({
  readOrganizationIdHeader: () => null,
}));

import { buildDashboardSessionContext } from "./dashboard-session-context.js";

describe("buildDashboardSessionContext usageQuota", () => {
  beforeEach(() => {
    getMembershipRoleForProject.mockResolvedValue("OWNER");
    loadPlanContextForProject.mockResolvedValue({
      planTier: "PRO",
      limits: { monthlyIngestUnits: 1000, retentionDays: 30 },
    });
    getMonthlyIngestUsed.mockResolvedValue(850);
    loadProjectAlertSettings.mockResolvedValue({
      errorSpike: { enabled: true, threshold: 25, windowMinutes: 15 },
      quota: { enabled: true, nearPercent: 85 },
    });
  });

  it("uses configurable nearPercent instead of a fixed 90% threshold", async () => {
    const ctx = await buildDashboardSessionContext(
      {} as never,
      { userId: "u1", email: "u@example.com" },
      {} as never
    );

    expect(ctx?.usageQuota?.nearQuota).toBe(true);
    expect(ctx?.usageQuota?.percentUsed).toBe(85);
  });

  it("does not set nearQuota when quota warnings are disabled", async () => {
    loadProjectAlertSettings.mockResolvedValueOnce({
      errorSpike: { enabled: true, threshold: 25, windowMinutes: 15 },
      quota: { enabled: false, nearPercent: 85 },
    });

    const ctx = await buildDashboardSessionContext(
      {} as never,
      { userId: "u1", email: "u@example.com" },
      {} as never
    );

    expect(ctx?.usageQuota?.nearQuota).toBe(false);
  });
});
