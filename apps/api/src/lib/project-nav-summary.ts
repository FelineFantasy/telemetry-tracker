import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

export type ProjectNavHealthStatus = "operational" | "degraded" | "outage" | "idle";

export type ProjectNavSummary = {
  projectId: string;
  status: ProjectNavHealthStatus;
  primaryEnvironment: string | null;
};

export function healthStatusFromCounts(events: number, errors: number): ProjectNavHealthStatus {
  const total = events + errors;
  if (total === 0) return "idle";
  const errorRatePct = (errors / total) * 100;
  if (errorRatePct >= 5) return "outage";
  if (errorRatePct >= 1) return "degraded";
  return "operational";
}

export async function getProjectNavSummary(
  prisma: PrismaClient,
  projectId: string,
  since: Date
): Promise<ProjectNavSummary> {
  const [events, errors, latestEvent] = await Promise.all([
    prisma.event.count({
      where: { project_id: projectId, created_at: { gte: since } },
    }),
    prisma.errorOccurrence.count({
      where: {
        created_at: { gte: since },
        error_group: { project_id: projectId },
      },
    }),
    prisma.event.findFirst({
      where: { project_id: projectId },
      orderBy: { created_at: "desc" },
      select: { environment: true },
    }),
  ]);

  return {
    projectId,
    status: healthStatusFromCounts(events, errors),
    primaryEnvironment: latestEvent?.environment?.trim() || null,
  };
}

export async function getProjectNavSummaries(
  prisma: PrismaClient,
  projectIds: string[],
  since: Date
): Promise<ProjectNavSummary[]> {
  if (projectIds.length === 0) return [];

  const idList = Prisma.join(projectIds.map((id) => Prisma.sql`${id}`));

  const [eventCounts, errorCountRows, latestEnvRows] = await Promise.all([
    prisma.event.groupBy({
      by: ["project_id"],
      where: { project_id: { in: projectIds }, created_at: { gte: since } },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ project_id: string; c: bigint }[]>(Prisma.sql`
      SELECT eg."project_id", COUNT(*)::bigint AS c
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eg."id" = eo."error_group_id"
      WHERE eg."project_id" IN (${idList})
        AND eo."created_at" >= ${since}
      GROUP BY eg."project_id"
    `),
    prisma.$queryRaw<{ project_id: string; environment: string | null }[]>(Prisma.sql`
      SELECT DISTINCT ON (e."project_id")
        e."project_id",
        e."environment"
      FROM "Event" e
      WHERE e."project_id" IN (${idList})
      ORDER BY e."project_id", e."created_at" DESC
    `),
  ]);

  const eventsByProject = new Map(
    eventCounts.map((row) => [row.project_id, row._count._all])
  );
  const errorsByProject = new Map(
    errorCountRows.map((row) => [row.project_id, Number(row.c)])
  );
  const envByProject = new Map(
    latestEnvRows.map((row) => [row.project_id, row.environment?.trim() || null])
  );

  return projectIds.map((projectId) => {
    const events = eventsByProject.get(projectId) ?? 0;
    const errors = errorsByProject.get(projectId) ?? 0;
    return {
      projectId,
      status: healthStatusFromCounts(events, errors),
      primaryEnvironment: envByProject.get(projectId) ?? null,
    };
  });
}
