import type { PrismaClient } from "@prisma/client";
import type { DashboardSessionContextPayload } from "./dashboard-session-context.js";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  filterInAppNotifications,
  filterInAppNotificationsForReadPersistence,
  parseNotificationPreferences,
  type NotificationPreferences,
} from "./notification-preferences.js";
import { billingAlertNotificationContent } from "./billing-alert.js";
import { billingNotificationKey } from "./billing-notification-keys.js";
import { buildTeamNotifications } from "./notification-team.js";
import { recentAlertNotifications } from "./alert-dispatch.js";
import { currentYearMonth } from "./usage-meter.js";
import { quotaNotificationKey } from "./quota-notification-keys.js";

export type DashboardNotificationItem = {
  id: string;
  type: "issue" | "billing" | "quota" | "team" | "alert";
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

function preferredQuotaCollisionItem(
  quota: DashboardNotificationItem,
  alert: DashboardNotificationItem,
  preferences: NotificationPreferences
): DashboardNotificationItem {
  const billingInApp = preferences.routing.billing.inapp;
  const alertsInApp = preferences.routing.alerts.inapp;
  if (billingInApp && !alertsInApp) return quota;
  if (alertsInApp && !billingInApp) return alert;
  if (billingInApp && alertsInApp) return alert;
  return quota;
}

/** Resolve quota session items vs fired alert rows that share the same dedupe id. */
export function dedupeNotificationItems(
  items: DashboardNotificationItem[],
  preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES
): DashboardNotificationItem[] {
  const byId = new Map<string, DashboardNotificationItem>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }
    const quota =
      existing.type === "quota"
        ? existing
        : item.type === "quota"
          ? item
          : null;
    const alert =
      existing.type === "alert"
        ? existing
        : item.type === "alert"
          ? item
          : null;
    if (quota && alert) {
      byId.set(item.id, preferredQuotaCollisionItem(quota, alert, preferences));
    } else {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

export type BuildDashboardNotificationsOptions = {
  /** Include items hidden by quiet hours (for mark-all-read persistence). */
  forReadPersistence?: boolean;
};

export async function buildDashboardNotifications(
  prisma: PrismaClient,
  projectId: string | null,
  session: DashboardSessionContextPayload,
  preferences: NotificationPreferences = parseNotificationPreferences(null),
  context?: NotificationBuildContext,
  options?: BuildDashboardNotificationsOptions
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
    items.push(...(await recentAlertNotifications(prisma, projectId)));

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

  const deduped = dedupeNotificationItems(items, preferences).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  if (options?.forReadPersistence) {
    return filterInAppNotificationsForReadPersistence(deduped, preferences);
  }

  return filterInAppNotifications(deduped, preferences);
}
