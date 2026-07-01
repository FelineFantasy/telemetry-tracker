import { randomUUID } from "node:crypto";
import { OrgRole, type PrismaClient } from "@prisma/client";
import { sendTransactionalEmail } from "./email.js";
import { dashboardOriginOrNull } from "./dashboard-origin.js";
import type { DashboardNotificationItem } from "./dashboard-notifications.js";
import {
  categoryForNotificationType,
  parseNotificationPreferences,
  shouldSendEmailForCategory,
  type NotificationPreferences,
} from "./notification-preferences.js";
import { quotaNotificationKey } from "./quota-notification-keys.js";
import {
  billingAlertNotificationContent,
  type BillingAlertVariant,
} from "./billing-alert.js";
import { billingNotificationKey } from "./billing-notification-keys.js";

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
          id: quotaNotificationKey(projectId, "exceeded"),
          type: "quota",
          title: "Monthly ingest limit reached",
          body: `${details.monthlyIngestUsed.toLocaleString()} / ${details.monthlyIngestLimit.toLocaleString()} units on your ${details.planTier} plan.`,
          occurredAt: new Date().toISOString(),
          href: "/dashboard/settings/billing",
        }
      : {
          id: quotaNotificationKey(projectId, "near"),
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
  variant: BillingAlertVariant,
  storedPlanTier: string,
  effectivePlanTier: string,
  stripeCurrentPeriodEnd?: Date | string | null
): Promise<void> {
  const { title, body } = billingAlertNotificationContent(
    variant,
    storedPlanTier,
    effectivePlanTier
  );
  const item: DashboardNotificationItem = {
    id: billingNotificationKey(
      organizationId,
      variant,
      stripeCurrentPeriodEnd
    ),
    type: "billing",
    title,
    body,
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
  member: {
    membershipId: string;
    email: string;
    displayName: string | null;
    role: string;
  }
): Promise<void> {
  const name = member.displayName?.trim() || member.email;
  const item: DashboardNotificationItem = {
    id: `team:member:${member.membershipId}`,
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

function organizationInviteEmailKey(inviteId: string, token: string): string {
  return `team:invite:${inviteId}:${token}`;
}

export async function sendOrganizationInviteEmail(
  prisma: PrismaClient,
  invite: { id: string; email: string; token: string },
  inviteUrl: string
): Promise<void> {
  if (!(await shouldSendInviteEmail(prisma, invite.email))) return;

  const notificationKey = organizationInviteEmailKey(invite.id, invite.token);
  const item: DashboardNotificationItem = {
    id: notificationKey,
    type: "team",
    title: "You're invited to Telemetry Tracker",
    body: "You were invited to join an organization on Telemetry Tracker.",
    occurredAt: new Date().toISOString(),
    href: `/register?invite=${encodeURIComponent(invite.token)}`,
  };

  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(invite.email) },
    select: {
      id: true,
      email: true,
      notification_preferences: true,
    },
  });

  if (user) {
    await sendNotificationEmailIfAllowed(
      prisma,
      user.id,
      user.email,
      item,
      parseNotificationPreferences(user.notification_preferences)
    );
    return;
  }

  const existing = await prisma.organizationInvite.findUnique({
    where: { id: invite.id },
    select: { invite_email_sent_token: true },
  });
  if (existing?.invite_email_sent_token === invite.token) return;

  const previousToken = existing?.invite_email_sent_token ?? null;
  const claimed = await prisma.organizationInvite.updateMany({
    where: {
      id: invite.id,
      invite_email_sent_token: previousToken,
    },
    data: { invite_email_sent_token: invite.token },
  });
  if (claimed.count === 0) return;

  const result = await sendTransactionalEmail({
    to: invite.email,
    subject: "You're invited to Telemetry Tracker",
    html: `<p>You were invited to join an organization on Telemetry Tracker.</p><p><a href="${inviteUrl}">Accept invite</a></p>`,
  });

  if (!result.sent && !result.devLogged) {
    await prisma.organizationInvite
      .update({
        where: { id: invite.id },
        data: { invite_email_sent_token: previousToken },
      })
      .catch(() => undefined);
  }
}
