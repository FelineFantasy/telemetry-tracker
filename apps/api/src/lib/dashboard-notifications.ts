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
import {
  recentAlertNotifications,
  recentAlertNotificationsForProjects,
} from "./alert-dispatch.js";
import { currentYearMonth } from "./usage-meter.js";
import { quotaNotificationKey } from "./quota-notification-keys.js";

export type DashboardNotificationType =
  | "issue"
  | "billing"
  | "quota"
  | "team"
  | "alert";

export type DashboardNotificationItem = {
  id: string;
  type: DashboardNotificationType;
  title: string;
  body: string;
  occurredAt: string;
  href: string | null;
  projectId?: string | null;
  projectName?: string | null;
};

export type NotificationBuildContext = {
  userId: string;
  userEmail: string;
  organizationIds: string[];
};

export type NotificationProjectRef = {
  id: string;
  name: string;
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
    projectId: null,
    projectName: null,
  };
}

function quotaNotifications(
  projectId: string,
  quota: NonNullable<DashboardSessionContextPayload["usageQuota"]>,
  projectName?: string | null
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
      projectId,
      projectName: projectName ?? null,
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
      projectId,
      projectName: projectName ?? null,
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
  /** Center uses longer history and higher per-source takes. */
  mode?: "bell" | "center";
  /** Attach project label when building for a known project. */
  projectMeta?: NotificationProjectRef | null;
};

const ISSUE_TAKE_BELL = 5;
const ISSUE_TAKE_CENTER = 25;

async function issueNotificationsForProject(
  prisma: PrismaClient,
  projectId: string,
  projectName: string | null,
  take: number
): Promise<DashboardNotificationItem[]> {
  const groups = await prisma.errorGroup.findMany({
    where: {
      project_id: projectId,
      resolved_at: null,
    },
    orderBy: { last_seen: "desc" },
    take,
    select: {
      id: true,
      message: true,
      app: true,
      environment: true,
      occurrences: true,
      last_seen: true,
    },
  });

  return groups.map((g) => {
    const envPart = g.environment ? ` · ${g.environment}` : "";
    return {
      id: `issue:${g.id}`,
      type: "issue" as const,
      title: g.message.length > 80 ? `${g.message.slice(0, 77)}…` : g.message,
      body: `${g.occurrences.toLocaleString()} occurrences · app ${g.app}${envPart}`,
      occurredAt: g.last_seen.toISOString(),
      href: `/dashboard/errors/${g.id}`,
      projectId,
      projectName,
    };
  });
}

async function issueNotificationsForProjects(
  prisma: PrismaClient,
  projects: NotificationProjectRef[],
  take: number
): Promise<DashboardNotificationItem[]> {
  if (projects.length === 0) return [];
  const byId = new Map(projects.map((p) => [p.id, p.name]));
  const groups = await prisma.errorGroup.findMany({
    where: {
      project_id: { in: projects.map((p) => p.id) },
      resolved_at: null,
    },
    orderBy: { last_seen: "desc" },
    take,
    select: {
      id: true,
      project_id: true,
      message: true,
      app: true,
      environment: true,
      occurrences: true,
      last_seen: true,
    },
  });

  return groups.map((g) => {
    const envPart = g.environment ? ` · ${g.environment}` : "";
    return {
      id: `issue:${g.id}`,
      type: "issue" as const,
      title: g.message.length > 80 ? `${g.message.slice(0, 77)}…` : g.message,
      body: `${g.occurrences.toLocaleString()} occurrences · app ${g.app}${envPart}`,
      occurredAt: g.last_seen.toISOString(),
      href: `/dashboard/errors/${g.id}`,
      projectId: g.project_id,
      projectName: byId.get(g.project_id) ?? null,
    };
  });
}

function finalizeNotificationItems(
  items: DashboardNotificationItem[],
  preferences: NotificationPreferences,
  options?: BuildDashboardNotificationsOptions
): DashboardNotificationItem[] {
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

export async function buildDashboardNotifications(
  prisma: PrismaClient,
  projectId: string | null,
  session: DashboardSessionContextPayload,
  preferences: NotificationPreferences = parseNotificationPreferences(null),
  context?: NotificationBuildContext,
  options?: BuildDashboardNotificationsOptions
): Promise<DashboardNotificationItem[]> {
  const items: DashboardNotificationItem[] = [];
  const mode = options?.mode ?? "bell";
  const projectName = options?.projectMeta?.name ?? null;
  const issueTake = mode === "center" ? ISSUE_TAKE_CENTER : ISSUE_TAKE_BELL;

  const billingItem = session.billingHealth
    ? billingNotification(session.billingHealth)
    : null;
  if (billingItem) items.push(billingItem);

  if (session.usageQuota && projectId) {
    items.push(...quotaNotifications(projectId, session.usageQuota, projectName));
  }

  if (projectId) {
    items.push(
      ...(await recentAlertNotifications(prisma, projectId, {
        mode,
        projectName,
      }))
    );
    items.push(
      ...(await issueNotificationsForProject(prisma, projectId, projectName, issueTake))
    );
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

  return finalizeNotificationItems(items, preferences, options);
}

/**
 * Org-wide Notification Center feed: billing + team once, alerts/issues across
 * accessible projects, plus live quota for the active project when present.
 */
export async function buildOrganizationDashboardNotifications(
  prisma: PrismaClient,
  projects: NotificationProjectRef[],
  activeProjectId: string | null,
  session: DashboardSessionContextPayload,
  preferences: NotificationPreferences = parseNotificationPreferences(null),
  context?: NotificationBuildContext,
  options?: BuildDashboardNotificationsOptions
): Promise<DashboardNotificationItem[]> {
  const items: DashboardNotificationItem[] = [];
  const mode = options?.mode ?? "center";
  const issueTake = mode === "center" ? 50 : ISSUE_TAKE_BELL;

  const billingItem = session.billingHealth
    ? billingNotification(session.billingHealth)
    : null;
  if (billingItem) items.push(billingItem);

  if (session.usageQuota && activeProjectId) {
    const activeMeta = projects.find((p) => p.id === activeProjectId) ?? null;
    items.push(
      ...quotaNotifications(activeProjectId, session.usageQuota, activeMeta?.name ?? null)
    );
  }

  if (projects.length > 0) {
    items.push(
      ...(await recentAlertNotificationsForProjects(prisma, projects, { mode }))
    );
    items.push(...(await issueNotificationsForProjects(prisma, projects, issueTake)));
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

  return finalizeNotificationItems(items, preferences, options);
}

export const NOTIFICATION_TYPES: DashboardNotificationType[] = [
  "issue",
  "billing",
  "quota",
  "team",
  "alert",
];

export function parseNotificationTypeFilter(
  raw: unknown
): DashboardNotificationType[] | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const types = parts.filter((p): p is DashboardNotificationType =>
    (NOTIFICATION_TYPES as string[]).includes(p)
  );
  return types.length > 0 ? types : null;
}

export function applyNotificationFeedFilters(
  items: DashboardNotificationItem[],
  filters: {
    types?: DashboardNotificationType[] | null;
    projectId?: string | null;
  }
): DashboardNotificationItem[] {
  let next = items;
  if (filters.types && filters.types.length > 0) {
    const allowed = new Set(filters.types);
    next = next.filter((item) => allowed.has(item.type));
  }
  if (filters.projectId) {
    next = next.filter((item) => item.projectId === filters.projectId);
  }
  return next;
}
