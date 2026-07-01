import { randomUUID } from "node:crypto";
import { OrgRole, type PrismaClient } from "@prisma/client";
import { sendTransactionalEmail } from "./email.js";
import { dashboardOriginOrNull } from "./dashboard-origin.js";
import type { DashboardNotificationItem } from "./dashboard-notifications.js";
import {
  categoryForNotificationType,
  parseNotificationPreferences,
  shouldSendEmailForCategory,
  type NotificationCategory,
  type NotificationPreferences,
} from "./notification-preferences.js";

function absoluteHref(href: string | null, base: string | null): string | null {
  if (!href) return null;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (!base) return href;
  return `${base.replace(/\/$/, "")}${href.startsWith("/") ? href : `/${href}`}`;
}

function emailHtml(item: DashboardNotificationItem, base: string | null): string {
  const link = absoluteHref(item.href, base);
  const linkBlock = link
    ? `<p><a href="${link}">View in Telemetry Tracker</a></p>`
    : "";
  return `<p><strong>${escapeHtml(item.title)}</strong></p><p>${escapeHtml(item.body)}</p>${linkBlock}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function sendNotificationEmailIfAllowed(
  prisma: PrismaClient,
  userId: string,
  email: string,
  item: DashboardNotificationItem,
  prefs: NotificationPreferences
): Promise<boolean> {
  const category = categoryForNotificationType(item.type);
  if (!shouldSendEmailForCategory(prefs, category)) {
    return false;
  }

  const claimed = await prisma.notificationEmailLog.createMany({
    data: [
      {
        id: randomUUID(),
        user_id: userId,
        notification_key: item.id,
      },
    ],
    skipDuplicates: true,
  });
  if (claimed.count === 0) return false;

  const base = dashboardOriginOrNull();
  const result = await sendTransactionalEmail({
    to: email,
    subject: `[Telemetry Tracker] ${item.title}`,
    html: emailHtml(item, base),
  });

  if (!result.sent && !result.devLogged) {
    await prisma.notificationEmailLog
      .delete({
        where: {
          user_id_notification_key: {
            user_id: userId,
            notification_key: item.id,
          },
        },
      })
      .catch(() => undefined);
    return false;
  }

  return true;
}

export async function notifyOrganizationMembersByEmail(
  prisma: PrismaClient,
  organizationId: string,
  item: DashboardNotificationItem,
  options?: { roles?: OrgRole[]; excludeEmails?: string[] }
): Promise<void> {
  const roles = options?.roles ?? [OrgRole.OWNER, OrgRole.EDITOR, OrgRole.VIEWER];
  const excludeEmails = new Set(
    (options?.excludeEmails ?? []).map((address) => normalizeEmail(address))
  );
  const members = await prisma.organizationMembership.findMany({
    where: {
      organization_id: organizationId,
      role: { in: roles },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          notification_preferences: true,
        },
      },
    },
  });

  await Promise.all(
    members
      .filter((member) => !excludeEmails.has(normalizeEmail(member.user.email)))
      .map((member) =>
        sendNotificationEmailIfAllowed(
          prisma,
          member.user.id,
          member.user.email,
          item,
          parseNotificationPreferences(member.user.notification_preferences)
        )
      )
  );
}

export async function notifyProjectMembersByEmail(
  prisma: PrismaClient,
  projectId: string,
  item: DashboardNotificationItem,
  options?: { roles?: OrgRole[] }
): Promise<void> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deleted_at: null },
    select: { organization_id: true },
  });
  if (!project) return;
  await notifyOrganizationMembersByEmail(
    prisma,
    project.organization_id,
    item,
    options
  );
}

export async function notifyNewErrorGroupEmail(
  prisma: PrismaClient,
  projectId: string,
  group: {
    id: string;
    message: string;
    app: string;
    environment: string | null;
  }
): Promise<void> {
  const envPart = group.environment ? ` · ${group.environment}` : "";
  const item: DashboardNotificationItem = {
    id: `issue:${group.id}`,
    type: "issue",
    title: "New error group",
    body: `${group.message.slice(0, 160)} · app ${group.app}${envPart}`,
    occurredAt: new Date().toISOString(),
    href: `/dashboard/errors/${group.id}`,
  };
  await notifyProjectMembersByEmail(prisma, projectId, item);
}

export async function notifyQuotaThresholdEmail(
  prisma: PrismaClient,
  projectId: string,
  kind: "near" | "exceeded",
  details: {
    planTier: string;
    monthlyIngestUsed: number;
    monthlyIngestLimit: number;
    percentUsed: number;
  }
): Promise<void> {
  const item: DashboardNotificationItem =
    kind === "exceeded"
      ? {
          id: "quota:exceeded",
          type: "quota",
          title: "Monthly ingest limit reached",
          body: `${details.monthlyIngestUsed.toLocaleString()} / ${details.monthlyIngestLimit.toLocaleString()} units on your ${details.planTier} plan.`,
          occurredAt: new Date().toISOString(),
          href: "/dashboard/settings/billing",
        }
      : {
          id: "quota:near",
          type: "quota",
          title: "Usage approaching limit",
          body: `${details.percentUsed}% of your ${details.planTier} plan monthly ingest.`,
          occurredAt: new Date().toISOString(),
          href: "/dashboard/settings/billing",
        };
  await notifyProjectMembersByEmail(prisma, projectId, item, {
    roles: [OrgRole.OWNER, OrgRole.EDITOR],
  });
}

export async function notifyBillingAlertEmail(
  prisma: PrismaClient,
  organizationId: string,
  variant: string,
  storedPlanTier: string,
  effectivePlanTier: string
): Promise<void> {
  const item: DashboardNotificationItem = {
    id: `billing:${variant}`,
    type: "billing",
    title:
      variant === "past_due"
        ? "Payment past due"
        : variant === "unpaid"
          ? "Subscription unpaid"
          : variant === "canceled"
            ? "Subscription canceled"
            : "Billing needs attention",
    body:
      variant === "past_due"
        ? `Update your payment method in Stripe. Your ${storedPlanTier} limits still apply.`
        : `Effective tier is ${effectivePlanTier}. Review billing in the dashboard.`,
    occurredAt: new Date().toISOString(),
    href: "/dashboard/settings/billing",
  };
  await notifyOrganizationMembersByEmail(prisma, organizationId, item, {
    roles: [OrgRole.OWNER, OrgRole.EDITOR],
  });
}

export async function notifyTeamMemberJoinedEmail(
  prisma: PrismaClient,
  organizationId: string,
  member: { email: string; displayName: string | null; role: string }
): Promise<void> {
  const name = member.displayName?.trim() || member.email;
  const item: DashboardNotificationItem = {
    id: `team:member:${organizationId}:${member.email}`,
    type: "team",
    title: "New team member",
    body: `${name} joined your organization as ${member.role}.`,
    occurredAt: new Date().toISOString(),
    href: "/dashboard/settings/team",
  };
  await notifyOrganizationMembersByEmail(prisma, organizationId, item, {
    roles: [OrgRole.OWNER, OrgRole.EDITOR],
    excludeEmails: [member.email],
  });
}

/** After ingest, email org owners/editors when usage crosses 90% or 100%. */
export async function maybeNotifyQuotaAfterIngest(
  prisma: PrismaClient,
  projectId: string
): Promise<void> {
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
  const details = {
    planTier: ctx.planTier,
    monthlyIngestUsed: used,
    monthlyIngestLimit: limit,
    percentUsed,
  };
  if (used >= limit) {
    void notifyQuotaThresholdEmail(prisma, projectId, "exceeded", details);
    return;
  }
  if (ratio >= 0.9) {
    void notifyQuotaThresholdEmail(prisma, projectId, "near", details);
  }
}

export async function shouldSendInviteEmail(
  prisma: PrismaClient,
  inviteeEmail: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email: inviteeEmail.trim().toLowerCase() },
    select: { notification_preferences: true },
  });
  if (!user) return true;
  const prefs = parseNotificationPreferences(user.notification_preferences);
  return shouldSendEmailForCategory(prefs, "team");
}
