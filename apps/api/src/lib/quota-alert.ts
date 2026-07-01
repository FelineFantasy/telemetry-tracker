import type { PrismaClient } from "@prisma/client";
import { fireProjectAlert } from "./alert-dispatch.js";
import { quotaNotificationKey } from "./quota-notification-keys.js";
import { currentYearMonth } from "./usage-meter.js";
import { loadProjectAlertSettings, quotaNearRatio } from "./error-spike-alert.js";

/** After ingest or quota check, fire near/exceeded alerts when configured. */
export async function maybeNotifyQuotaAlerts(
  prisma: PrismaClient,
  projectId: string
): Promise<void> {
  const settings = await loadProjectAlertSettings(prisma, projectId);

  const { loadPlanContextForProject, getMonthlyIngestUsed } = await import(
    "./plan-enforcement.js"
  );
  const ctx = await loadPlanContextForProject(prisma, projectId);
  if (!ctx) return;
  const used = await getMonthlyIngestUsed(prisma, projectId);
  const limit = ctx.limits.monthlyIngestUnits;
  if (limit <= 0) return;
  const ratio = used / limit;
  const percentUsed = Math.round(ratio * 100);
  const yearMonth = currentYearMonth();

  if (used >= limit) {
    void fireProjectAlert(prisma, {
      projectId,
      rule: "QUOTA_EXCEEDED",
      dedupeKey: quotaNotificationKey(projectId, "exceeded", yearMonth),
      title: "Monthly ingest limit reached",
      body: `${used.toLocaleString()} / ${limit.toLocaleString()} units on your ${ctx.planTier} plan.`,
      href: "/dashboard/settings/billing",
    });
    return;
  }

  if (!settings.quota.enabled) return;

  if (ratio >= quotaNearRatio(settings)) {
    void fireProjectAlert(prisma, {
      projectId,
      rule: "QUOTA_NEAR",
      dedupeKey: quotaNotificationKey(projectId, "near", yearMonth),
      title: "Usage approaching limit",
      body: `${percentUsed}% of your ${ctx.planTier} plan monthly ingest (${used.toLocaleString()} / ${limit.toLocaleString()} units).`,
      href: "/dashboard/settings/billing",
    });
  }
}
