import type { PrismaClient } from "@prisma/client";

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
  return Promise.all(projectIds.map((id) => getProjectNavSummary(prisma, id, since)));
}
