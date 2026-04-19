import { Prisma, type PlanTier, type PrismaClient } from "@prisma/client";
import { limitsForPlan, type PlanLimits } from "../config/plans.js";
import { currentYearMonth } from "./usage-meter.js";

export type PlanContext = {
  organizationId: string;
  planTier: PlanTier;
  limits: PlanLimits;
};

const QUOTA_EXCEEDED = "Monthly ingest quota exceeded for this project.";
const APP_LIMIT = "Distinct app label limit reached for this project (plan limit).";
const PROJECT_LIMIT = "Project limit reached for this organization (plan limit).";
const KEY_LIMIT = "API key limit reached for this project (plan limit).";

export async function loadPlanContextForProject(
  prisma: PrismaClient,
  projectId: string
): Promise<PlanContext | null> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, deleted_at: null },
    select: {
      organization_id: true,
      organization: {
        select: { plan_tier: true, deleted_at: true },
      },
    },
  });
  if (!row || row.organization.deleted_at) return null;
  const tier = row.organization.plan_tier;
  return {
    organizationId: row.organization_id,
    planTier: tier,
    limits: limitsForPlan(tier),
  };
}

export async function getMonthlyIngestUsed(
  prisma: PrismaClient,
  projectId: string
): Promise<number> {
  const ym = currentYearMonth();
  const row = await prisma.usageMonthly.findUnique({
    where: {
      project_id_year_month: { project_id: projectId, year_month: ym },
    },
    select: { ingest_units: true },
  });
  return row?.ingest_units ?? 0;
}

export function checkMonthlyIngestUnits(
  used: number,
  additional: number,
  limits: PlanLimits
): { ok: true } | { ok: false; error: string } {
  if (used + additional > limits.monthlyIngestUnits) {
    return { ok: false, error: QUOTA_EXCEEDED };
  }
  return { ok: true };
}

/**
 * Which of the given `app` labels already appear in Event / Session / ErrorGroup for this project.
 * Scoped `IN (...)` queries — avoids a full distinct scan on every ingest when labels are unchanged.
 */
export async function findAppsAlreadyRegisteredInProject(
  prisma: PrismaClient,
  projectId: string,
  appLabels: string[]
): Promise<Set<string>> {
  const unique = [...new Set(appLabels)];
  if (unique.length === 0) return new Set();
  const inList = Prisma.join(unique.map((a) => Prisma.sql`${a}`));
  const rows = await prisma.$queryRaw<{ app: string }[]>(Prisma.sql`
    SELECT DISTINCT app FROM (
      SELECT app FROM "Event" WHERE project_id = ${projectId} AND app IN (${inList})
      UNION
      SELECT app FROM "Session" WHERE project_id = ${projectId} AND app IN (${inList})
      UNION
      SELECT app FROM "ErrorGroup" WHERE project_id = ${projectId} AND app IN (${inList})
    ) AS u
  `);
  return new Set(rows.map((r) => r.app));
}

/** Full distinct app count — only call when the ingest payload may introduce new app labels. */
export async function countDistinctAppsInProject(
  prisma: PrismaClient,
  projectId: string
): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n FROM (
      SELECT DISTINCT app FROM "Event" WHERE project_id = ${projectId}
      UNION
      SELECT DISTINCT app FROM "Session" WHERE project_id = ${projectId}
      UNION
      SELECT DISTINCT app FROM "ErrorGroup" WHERE project_id = ${projectId}
    ) AS u
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function assertIngestPlanOrReply(
  prisma: PrismaClient,
  projectId: string,
  additionalUnits: number,
  appLabels: string[]
): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
  const ctx = await loadPlanContextForProject(prisma, projectId);
  if (!ctx) {
    return {
      ok: false,
      status: 403,
      body: { error: "Project not found or organization inactive." },
    };
  }
  const used = await getMonthlyIngestUsed(prisma, projectId);
  const m = checkMonthlyIngestUnits(used, additionalUnits, ctx.limits);
  if (!m.ok) {
    return {
      ok: false,
      status: 429,
      body: {
        error: m.error,
        code: "monthly_ingest_quota",
        limit: ctx.limits.monthlyIngestUnits,
        used,
      },
    };
  }
  const uniqueLabels = [...new Set(appLabels)];
  const already = await findAppsAlreadyRegisteredInProject(
    prisma,
    projectId,
    uniqueLabels
  );
  const newLabels = uniqueLabels.filter((a) => !already.has(a));
  if (newLabels.length > 0) {
    const totalDistinct = await countDistinctAppsInProject(prisma, projectId);
    if (totalDistinct + newLabels.length > ctx.limits.maxAppsPerProject) {
      return {
        ok: false,
        status: 403,
        body: {
          error: APP_LIMIT,
          code: "max_apps_per_project",
          limit: ctx.limits.maxAppsPerProject,
        },
      };
    }
  }
  return { ok: true };
}

export async function countActiveProjectsForOrg(
  prisma: PrismaClient,
  organizationId: string
): Promise<number> {
  return prisma.project.count({
    where: { organization_id: organizationId, deleted_at: null },
  });
}

export async function assertCanCreateProject(
  prisma: PrismaClient,
  organizationId: string
): Promise<{ ok: true; limits: PlanLimits } | { ok: false; error: string }> {
  const org = await prisma.organization.findFirst({
    where: { id: organizationId, deleted_at: null },
    select: { plan_tier: true },
  });
  if (!org) return { ok: false, error: "Organization not found." };
  const limits = limitsForPlan(org.plan_tier);
  const n = await countActiveProjectsForOrg(prisma, organizationId);
  if (n >= limits.maxProjectsPerOrg) {
    return { ok: false, error: PROJECT_LIMIT };
  }
  return { ok: true, limits };
}

export async function countActiveApiKeysForProject(
  prisma: PrismaClient,
  projectId: string
): Promise<number> {
  return prisma.apiKey.count({
    where: {
      project_id: projectId,
      deleted_at: null,
      revoked_at: null,
    },
  });
}

export async function assertCanCreateApiKey(
  prisma: PrismaClient,
  projectId: string
): Promise<{ ok: true; limits: PlanLimits } | { ok: false; error: string }> {
  const proj = await prisma.project.findFirst({
    where: { id: projectId, deleted_at: null },
    select: {
      organization: { select: { plan_tier: true, deleted_at: true } },
    },
  });
  if (!proj || proj.organization.deleted_at) {
    return { ok: false, error: "Project not found." };
  }
  const limits = limitsForPlan(proj.organization.plan_tier);
  const n = await countActiveApiKeysForProject(prisma, projectId);
  if (n >= limits.maxApiKeysPerProject) {
    return { ok: false, error: KEY_LIMIT };
  }
  return { ok: true, limits };
}
