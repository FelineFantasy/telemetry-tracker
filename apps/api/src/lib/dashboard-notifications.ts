import type { PrismaClient } from "@prisma/client";
import type { DashboardSessionContextPayload } from "./dashboard-session-context.js";
import {
  filterInAppNotifications,
  parseNotificationPreferences,
  type NotificationPreferences,
} from "./notification-preferences.js";
import { billingAlertNotificationContent } from "./billing-alert.js";
import { billingNotificationKey } from "./billing-notification-keys.js";
import { buildTeamNotifications } from "./notification-team.js";
import { currentYearMonth } from "./usage-meter.js";
import { quotaNotificationKey } from "./quota-notification-keys.js";

export type DashboardNotificationItem = {
  id: string;
  type: "issue" | "billing" | "quota" | "team";
  title: string;
  body: string;
  occurredAt: string;
  href: string | null;
};

export type NotificationBuildContext = {
  userId: string;
  userEmail: string;
  organizationIds: string[];
};

function billingNotification(
  billing: NonNullable<DashboardSessionContextPayload["billingHealth"]>
): DashboardNotificationItem | null {
  const variant = billing.billingAlertVariant;
  if (!variant) return null;

  const occurredAt =
    billing.stripeCurrentPeriodEnd ?? new Date().toISOString();
  const { title, body } = billingAlertNotificationContent(
    variant,
    billing.storedPlanTier,
    billing.effectivePlanTier
  );

  return {
    id: billingNotificationKey(
      billing.organizationId,
      variant,
      billing.stripeCurrentPeriodEnd
    ),
    type: "billing",
    title,
    body,
    occurredAt,
    href: "/dashboard/settings/billing",
  };
}

function quotaNotifications(
  projectId: string,
  quota: NonNullable<DashboardSessionContextPayload["usageQuota"]>
): DashboardNotificationItem[] {
  const items: DashboardNotificationItem[] = [];
  const occurredAt = new Date().toISOString();
  const yearMonth = currentYearMonth();

  if (quota.quotaExceeded) {
    items.push({
      id: quotaNotificationKey(projectId, "exceeded", yearMonth),
      type: "quota",
      title: "Monthly ingest limit reached",
      body: `${quota.monthlyIngestUsed.toLocaleString()} / ${quota.monthlyIngestLimit.toLocaleString()} units on your ${quota.planTier} plan. New ingest is being rejected.`,
      occurredAt,
      href: "/dashboard/settings/billing",
    });
    return items;
  }

  if (quota.nearQuota) {
    items.push({
      id: quotaNotificationKey(projectId, "near", yearMonth),
      type: "quota",
      title: "Usage approaching limit",
      body: `${quota.percentUsed}% of your ${quota.planTier} plan monthly ingest (${quota.monthlyIngestUsed.toLocaleString()} / ${quota.monthlyIngestLimit.toLocaleString()} units).`,
      occurredAt,
      href: "/dashboard/settings/billing",
    });
  }

  return items;
}

export async function buildDashboardNotifications(
  prisma: PrismaClient,
  projectId: string | null,
  session: DashboardSessionContextPayload,
  preferences: NotificationPreferences = parseNotificationPreferences(null),
  context?: NotificationBuildContext
): Promise<DashboardNotificationItem[]> {
  const items: DashboardNotificationItem[] = [];

  const billingItem = session.billingHealth
    ? billingNotification(session.billingHealth)
    : null;
  if (billingItem) items.push(billingItem);

  if (session.usageQuota && projectId) {
    items.push(...quotaNotifications(projectId, session.usageQuota));
  }

  if (projectId) {
    const groups = await prisma.errorGroup.findMany({
      where: {
        project_id: projectId,
        resolved_at: null,
      },
      orderBy: { last_seen: "desc" },
      take: 5,
      select: {
        id: true,
        message: true,
        app: true,
        environment: true,
        occurrences: true,
        last_seen: true,
      },
    });

    for (const g of groups) {
      const envPart = g.environment ? ` · ${g.environment}` : "";
      items.push({
        id: `issue:${g.id}`,
        type: "issue",
        title: g.message.length > 80 ? `${g.message.slice(0, 77)}…` : g.message,
        body: `${g.occurrences.toLocaleString()} occurrences · app ${g.app}${envPart}`,
        occurredAt: g.last_seen.toISOString(),
        href: `/dashboard/errors/${g.id}`,
      });
    }
  }

  if (context) {
    items.push(
      ...(await buildTeamNotifications(
        prisma,
        context.userId,
        context.userEmail,
        context.organizationIds
      ))
    );
  }

  items.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  return filterInAppNotifications(items, preferences);
}
