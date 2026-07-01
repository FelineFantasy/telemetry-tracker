import type { PrismaClient } from "@prisma/client";
import type { DashboardSessionContextPayload } from "./dashboard-session-context.js";
import {
  filterInAppNotifications,
  parseNotificationPreferences,
  type NotificationPreferences,
} from "./notification-preferences.js";
import { buildTeamNotifications } from "./notification-team.js";

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

  switch (variant) {
    case "past_due":
      return {
        id: "billing:past_due",
        type: "billing",
        title: "Payment past due",
        body: `Update your payment method in Stripe. Your ${billing.storedPlanTier} limits still apply until the subscription updates.`,
        occurredAt,
        href: "/dashboard/settings/billing",
      };
    case "unpaid":
      return {
        id: "billing:unpaid",
        type: "billing",
        title: "Subscription unpaid",
        body: `Effective tier is ${billing.effectivePlanTier}. Update billing to restore paid limits.`,
        occurredAt,
        href: "/dashboard/settings/billing",
      };
    case "canceled":
      return {
        id: "billing:canceled",
        type: "billing",
        title: "Subscription canceled",
        body: `Entitlements follow the ${billing.effectivePlanTier} tier.`,
        occurredAt,
        href: "/dashboard/settings/billing",
      };
    case "incomplete":
      return {
        id: "billing:incomplete",
        type: "billing",
        title: "Subscription incomplete",
        body: `Entitlements use the ${billing.effectivePlanTier} tier until payment completes.`,
        occurredAt,
        href: "/dashboard/settings/billing",
      };
    case "incomplete_expired":
      return {
        id: "billing:incomplete_expired",
        type: "billing",
        title: "Subscription setup expired",
        body: `Entitlements use the ${billing.effectivePlanTier} tier until you subscribe again.`,
        occurredAt,
        href: "/dashboard/settings/billing",
      };
    default:
      return null;
  }
}

function quotaNotifications(
  quota: NonNullable<DashboardSessionContextPayload["usageQuota"]>
): DashboardNotificationItem[] {
  const items: DashboardNotificationItem[] = [];
  const occurredAt = new Date().toISOString();

  if (quota.quotaExceeded) {
    items.push({
      id: "quota:exceeded",
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
      id: "quota:near",
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

  if (session.usageQuota) {
    items.push(...quotaNotifications(session.usageQuota));
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
