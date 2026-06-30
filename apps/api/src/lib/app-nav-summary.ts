import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { distinctAppsForProject } from "./project-scope-labels.js";
import {
  healthStatusFromCounts,
  type ProjectNavHealthStatus,
} from "./project-nav-summary.js";

export type AppNavSummary = {
  app: string;
  status: ProjectNavHealthStatus;
  primaryEnvironment: string | null;
};

export async function getAppNavSummary(
  prisma: PrismaClient,
  projectId: string,
  app: string,
  since: Date
): Promise<AppNavSummary> {
  const [events, errors, latestEvent] = await Promise.all([
    prisma.event.count({
      where: { project_id: projectId, app, created_at: { gte: since } },
    }),
    prisma.errorOccurrence.count({
      where: {
        created_at: { gte: since },
        error_group: { project_id: projectId, app },
      },
    }),
    prisma.event.findFirst({
      where: { project_id: projectId, app },
      orderBy: { created_at: "desc" },
      select: { environment: true },
    }),
  ]);

  return {
    app,
    status: healthStatusFromCounts(events, errors),
    primaryEnvironment: latestEvent?.environment?.trim() || null,
  };
}

export async function getAppNavSummariesForProject(
  prisma: PrismaClient,
  projectId: string,
  since: Date
): Promise<AppNavSummary[]> {
  const apps = await distinctAppsForProject(prisma, projectId);
  if (apps.length === 0) return [];

  const appList = Prisma.join(apps.map((app) => Prisma.sql`${app}`));

  const [eventCounts, errorCountRows, latestEnvRows] = await Promise.all([
    prisma.event.groupBy({
      by: ["app"],
      where: {
        project_id: projectId,
        app: { in: apps },
        created_at: { gte: since },
      },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ app: string; c: bigint }[]>(Prisma.sql`
      SELECT eg."app", COUNT(*)::bigint AS c
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eg."id" = eo."error_group_id"
      WHERE eg."project_id" = ${projectId}
        AND eg."app" IN (${appList})
        AND eo."created_at" >= ${since}
      GROUP BY eg."app"
    `),
    prisma.$queryRaw<{ app: string; environment: string | null }[]>(Prisma.sql`
      SELECT DISTINCT ON (e."app")
        e."app",
        e."environment"
      FROM "Event" e
      WHERE e."project_id" = ${projectId}
        AND e."app" IN (${appList})
      ORDER BY e."app", e."created_at" DESC
    `),
  ]);

  const eventsByApp = new Map(eventCounts.map((row) => [row.app, row._count._all]));
  const errorsByApp = new Map(errorCountRows.map((row) => [row.app, Number(row.c)]));
  const envByApp = new Map(
    latestEnvRows.map((row) => [row.app, row.environment?.trim() || null])
  );

  return apps.map((app) => {
    const events = eventsByApp.get(app) ?? 0;
    const errors = errorsByApp.get(app) ?? 0;
    return {
      app,
      status: healthStatusFromCounts(events, errors),
      primaryEnvironment: envByApp.get(app) ?? null,
    };
  });
}
