import { OrgRole, type PrismaClient } from "@prisma/client";
import type { DashboardNotificationItem } from "./dashboard-notifications.js";
import { teamInviteNotificationKey } from "./team-notification-keys.js";

const RECENT_MEMBER_DAYS = 14;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function buildTeamNotifications(
  prisma: PrismaClient,
  userId: string,
  userEmail: string,
  organizationIds: string[]
): Promise<DashboardNotificationItem[]> {
  const items: DashboardNotificationItem[] = [];
  const email = normalizeEmail(userEmail);
  const now = new Date();
  const memberSince = new Date(now.getTime() - RECENT_MEMBER_DAYS * 24 * 60 * 60 * 1000);

  const pendingInvites = await prisma.organizationInvite.findMany({
    where: {
      email,
      expires_at: { gt: now },
      organization: { deleted_at: null },
    },
    include: {
      organization: { select: { id: true, name: true } },
    },
    orderBy: { created_at: "desc" },
    take: 5,
  });

  for (const invite of pendingInvites) {
    items.push({
      id: teamInviteNotificationKey(invite.id, invite.token),
      type: "team",
      title: `Invitation to ${invite.organization.name}`,
      body: `You were invited as ${invite.role}. Accept to join the organization.`,
      occurredAt: invite.created_at.toISOString(),
      href: `/register?invite=${encodeURIComponent(invite.token)}`,
    });
  }

  if (organizationIds.length === 0) {
    return items;
  }

  const actorMemberships = await prisma.organizationMembership.findMany({
    where: {
      user_id: userId,
      organization_id: { in: organizationIds },
      role: { in: [OrgRole.OWNER, OrgRole.EDITOR] },
    },
    select: { organization_id: true },
  });

  const manageOrgIds = actorMemberships.map((m) => m.organization_id);
  if (manageOrgIds.length === 0) {
    return items;
  }

  const recentMembers = await prisma.organizationMembership.findMany({
    where: {
      organization_id: { in: manageOrgIds },
      user_id: { not: userId },
      created_at: { gte: memberSince },
    },
    include: {
      user: { select: { email: true, display_name: true } },
      organization: { select: { name: true } },
    },
    orderBy: { created_at: "desc" },
    take: 5,
  });

  for (const row of recentMembers) {
    const name = row.user.display_name?.trim() || row.user.email;
    items.push({
      id: `team:member:${row.id}`,
      type: "team",
      title: "New team member",
      body: `${name} joined ${row.organization.name} as ${row.role}.`,
      occurredAt: row.created_at.toISOString(),
      href: "/dashboard/settings/team",
    });
  }

  return items;
}
