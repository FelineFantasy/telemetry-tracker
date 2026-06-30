import type { PrismaClient } from "@prisma/client";
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

async function distinctAppsForProject(
  prisma: PrismaClient,
  projectId: string
): Promise<string[]> {
  const [eventsApps, errorsApps, sessionsApps] = await Promise.all([
    prisma.event.groupBy({
      by: ["app"],
      where: { project_id: projectId },
    }),
    prisma.errorGroup.groupBy({
      by: ["app"],
      where: { project_id: projectId },
    }),
    prisma.session.groupBy({
      by: ["app"],
      where: { project_id: projectId },
    }),
  ]);

  return [
    ...new Set([
      ...eventsApps.map((row) => row.app),
      ...errorsApps.map((row) => row.app),
      ...sessionsApps.map((row) => row.app),
    ]),
  ].sort();
}

export async function getAppNavSummariesForProject(
  prisma: PrismaClient,
  projectId: string,
  since: Date
): Promise<AppNavSummary[]> {
  const apps = await distinctAppsForProject(prisma, projectId);
  if (apps.length === 0) return [];
  return Promise.all(apps.map((app) => getAppNavSummary(prisma, projectId, app, since)));
}
