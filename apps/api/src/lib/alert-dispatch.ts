import { randomUUID } from "node:crypto";
import { OrgRole, type AlertRuleType, type PrismaClient } from "@prisma/client";
import type { DashboardNotificationItem } from "./dashboard-notifications.js";
import { notifyProjectMembersByEmail } from "./notification-email-dispatch.js";

export type AlertFirePayload = {
  projectId: string;
  rule: AlertRuleType;
  dedupeKey: string;
  title: string;
  body: string;
  href: string | null;
};

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P2002"
  );
}

/** Default in-app link when legacy rows have no stored href. */
export function alertEventHref(rule: AlertRuleType, stored: string | null): string | null {
  if (stored) return stored;
  switch (rule) {
    case "ERROR_SPIKE":
      return "/dashboard/errors";
    case "QUOTA_NEAR":
    case "QUOTA_EXCEEDED":
      return "/dashboard/settings/billing";
    default:
      return "/dashboard/alerts";
  }
}

/** Record alert history and notify org members (email deduped via notification key). */
export async function fireProjectAlert(
  prisma: PrismaClient,
  payload: AlertFirePayload
): Promise<boolean> {
  try {
    await prisma.alertEvent.create({
      data: {
        id: randomUUID(),
        project_id: payload.projectId,
        rule: payload.rule,
        title: payload.title,
        body: payload.body,
        href: payload.href,
        dedupe_key: payload.dedupeKey,
      },
    });
  } catch (e: unknown) {
    if (isUniqueViolation(e)) return false;
    throw e;
  }

  const item: DashboardNotificationItem = {
    id: payload.dedupeKey,
    type: "alert",
    title: payload.title,
    body: payload.body,
    occurredAt: new Date().toISOString(),
    href: payload.href,
  };

  void notifyProjectMembersByEmail(prisma, payload.projectId, item, {
    roles: [OrgRole.OWNER, OrgRole.EDITOR],
  });

  return true;
}

export async function listRecentAlertEvents(
  prisma: PrismaClient,
  projectId: string,
  limit = 25
) {
  return prisma.alertEvent.findMany({
    where: { project_id: projectId },
    orderBy: { fired_at: "desc" },
    take: limit,
    select: {
      id: true,
      rule: true,
      title: true,
      body: true,
      href: true,
      dedupe_key: true,
      fired_at: true,
    },
  });
}

const RECENT_ALERTS_IN_BELL_DAYS = 7;

export async function recentAlertNotifications(
  prisma: PrismaClient,
  projectId: string
): Promise<DashboardNotificationItem[]> {
  const since = new Date(Date.now() - RECENT_ALERTS_IN_BELL_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.alertEvent.findMany({
    where: {
      project_id: projectId,
      fired_at: { gte: since },
      rule: "ERROR_SPIKE",
    },
    orderBy: { fired_at: "desc" },
    take: 5,
    select: {
      rule: true,
      title: true,
      body: true,
      href: true,
      dedupe_key: true,
      fired_at: true,
    },
  });

  return rows
    .filter((row) => row.rule === "ERROR_SPIKE")
    .map((row) => ({
      id: row.dedupe_key,
      type: "alert" as const,
      title: row.title,
      body: row.body,
      occurredAt: row.fired_at.toISOString(),
      href: alertEventHref(row.rule, row.href),
    }));
}
