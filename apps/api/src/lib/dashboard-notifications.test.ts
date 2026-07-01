import { describe, expect, it } from "vitest";
import { buildDashboardNotifications } from "./dashboard-notifications.js";
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
  usageQuota: null,
  billingHealth: null,
};

describe("buildDashboardNotifications", () => {
  it("includes billing and quota items", async () => {
    const prisma = {
      alertEvent: { findMany: async () => [] },
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
      alertEvent: { findMany: async () => [] },
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

  it("keeps session quota in bell when billing routing is on and alerts routing is off", async () => {
    const prisma = {
      alertEvent: { findMany: async () => [] },
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

    const items = await buildDashboardNotifications(
      prisma,
      "p1",
      {
        ...baseSession,
        usageQuota: {
          planTier: "PRO",
          monthlyIngestUsed: 950,
          monthlyIngestLimit: 1000,
          percentUsed: 95,
          quotaExceeded: false,
          nearQuota: true,
          retentionDays: 30,
        },
      },
      prefs
    );

    expect(items.some((i) => i.type === "quota" && i.id.startsWith("quota:near:p1:"))).toBe(
      true
    );
    expect(items.some((i) => i.type === "alert")).toBe(false);
  });

  it("prefers session quota when a duplicate quota alert shares the same id", async () => {
    const yearMonth = new Date().toISOString().slice(0, 7);
    const quotaId = `quota:near:p1:${yearMonth}`;
    const prisma = {
      alertEvent: {
        findMany: async () => [
          {
            rule: "QUOTA_NEAR",
            title: "Usage approaching limit",
            body: "fired alert",
            href: "/dashboard/settings/billing",
            dedupe_key: quotaId,
            fired_at: new Date("2026-07-01T12:00:00.000Z"),
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

    const items = await buildDashboardNotifications(
      prisma,
      "p1",
      {
        ...baseSession,
        usageQuota: {
          planTier: "PRO",
          monthlyIngestUsed: 950,
          monthlyIngestLimit: 1000,
          percentUsed: 95,
          quotaExceeded: false,
          nearQuota: true,
          retentionDays: 30,
        },
      },
      prefs
    );

    expect(items.filter((i) => i.id === quotaId)).toEqual([
      expect.objectContaining({ type: "quota", id: quotaId }),
    ]);
  });

  it("shows quota alert in bell when alerts routing is on and billing routing is off", async () => {
    const yearMonth = new Date().toISOString().slice(0, 7);
    const quotaId = `quota:near:p1:${yearMonth}`;
    const prisma = {
      alertEvent: {
        findMany: async () => [
          {
            rule: "QUOTA_NEAR",
            title: "Usage approaching limit",
            body: "85% of your PRO plan monthly ingest",
            href: "/dashboard/settings/billing",
            dedupe_key: quotaId,
            fired_at: new Date("2026-07-01T12:00:00.000Z"),
          },
        ],
      },
      errorGroup: { findMany: async () => [] },
    } as never;

    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      routing: {
        ...DEFAULT_NOTIFICATION_PREFERENCES.routing,
        billing: { inapp: false, email: true },
        alerts: { inapp: true, email: true },
      },
    };

    const items = await buildDashboardNotifications(
      prisma,
      "p1",
      {
        ...baseSession,
        usageQuota: {
          planTier: "PRO",
          monthlyIngestUsed: 850,
          monthlyIngestLimit: 1000,
          percentUsed: 85,
          quotaExceeded: false,
          nearQuota: true,
          retentionDays: 30,
        },
      },
      prefs
    );

    expect(items.filter((i) => i.id === quotaId)).toEqual([
      expect.objectContaining({ type: "alert", id: quotaId }),
    ]);
  });
});
