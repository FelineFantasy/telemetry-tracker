import type { FastifyRequest } from "fastify";
import { OrgRole, type PrismaClient } from "@prisma/client";
import type { SessionUser } from "./auth-session.js";
import {
  type BillingHealthSnapshot,
  billingHealthFromPlanContext,
} from "./billing-alert.js";
import { readOrganizationIdHeader } from "./http-headers.js";
import { getMonthlyIngestUsed, loadPlanContextForOrganization, loadPlanContextForProject } from "./plan-enforcement.js";
import {
  canArchiveOrganization,
  canArchiveProject,
  canCreateApiKey,
  canCreateProject,
  canManageMembers,
  canResolveErrors,
  canRevokeApiKey,
  getMembershipRoleForOrganization,
  getMembershipRoleForProject,
} from "./org-permissions.js";
import { loadProjectAlertSettings, quotaNearRatio } from "./error-spike-alert.js";
import { tryResolveReadProjectId } from "./read-project-request.js";

export type DashboardSessionContextPayload = {
  projectId: string;
  role: OrgRole;
  canResolveErrors: boolean;
  canCreateApiKey: boolean;
  canRevokeApiKey: boolean;
  canCreateProject: boolean;
  canManageMembers: boolean;
  canArchiveOrganization: boolean;
  canArchiveProject: boolean;
  usageQuota: {
    planTier: string;
    monthlyIngestUsed: number;
    monthlyIngestLimit: number;
    percentUsed: number;
    quotaExceeded: boolean;
    nearQuota: boolean;
    retentionDays: number;
  } | null;
  billingHealth: BillingHealthSnapshot | null;
};

/** Role and capability flags for the active project / sidebar org. Returns null when forbidden. */
export async function buildDashboardSessionContext(
  prisma: PrismaClient,
  session: SessionUser,
  request: FastifyRequest,
  projectIdOverride?: string | null
): Promise<DashboardSessionContextPayload | null> {
  const headerOrg = readOrganizationIdHeader(request);
  const projectId =
    projectIdOverride !== undefined
      ? projectIdOverride
      : await tryResolveReadProjectId(request);
  const projRole =
    projectId !== null
      ? await getMembershipRoleForProject(session.userId, projectId)
      : null;

  const orgRoleFromHeader = headerOrg
    ? await getMembershipRoleForOrganization(session.userId, headerOrg)
    : null;
  const orgCapabilityRole = orgRoleFromHeader ?? projRole;

  if (projRole === null && orgCapabilityRole === null) {
    return null;
  }

  let usageQuota: NonNullable<DashboardSessionContextPayload["usageQuota"]> | null = null;
  let billingHealth: BillingHealthSnapshot | null = null;

  if (projectId !== null) {
    const ctx = await loadPlanContextForProject(prisma, projectId);
    if (ctx) {
      const used = await getMonthlyIngestUsed(prisma, projectId);
      const limit = ctx.limits.monthlyIngestUnits;
      const ratio = limit > 0 ? used / limit : 0;
      const quotaExceeded = limit > 0 && used >= limit;
      const alertSettings = await loadProjectAlertSettings(prisma, projectId);
      usageQuota = {
        planTier: ctx.planTier,
        monthlyIngestUsed: used,
        monthlyIngestLimit: limit,
        percentUsed: Math.round(ratio * 100),
        quotaExceeded,
        nearQuota:
          !quotaExceeded &&
          alertSettings.quota.enabled &&
          ratio >= quotaNearRatio(alertSettings),
        retentionDays: ctx.limits.retentionDays,
      };
      billingHealth = billingHealthFromPlanContext(ctx);
    }
  } else if (headerOrg) {
    const ctx = await loadPlanContextForOrganization(prisma, headerOrg);
    if (ctx) {
      billingHealth = billingHealthFromPlanContext(ctx);
    }
  }

  return {
    projectId: projectId ?? "",
    role: projRole ?? orgCapabilityRole ?? OrgRole.VIEWER,
    canResolveErrors: canResolveErrors(projRole),
    canCreateApiKey: canCreateApiKey(projRole),
    canRevokeApiKey: canRevokeApiKey(projRole),
    canCreateProject: canCreateProject(orgCapabilityRole),
    canManageMembers: canManageMembers(orgCapabilityRole),
    canArchiveOrganization: canArchiveOrganization(orgCapabilityRole),
    canArchiveProject: canArchiveProject(orgCapabilityRole),
    usageQuota,
    billingHealth,
  };
}
