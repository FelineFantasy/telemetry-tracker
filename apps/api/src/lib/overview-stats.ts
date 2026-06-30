/**
 * Overview aggregates beyond the core error/event counts.
 */
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { OverviewTimeSeriesPoint } from "./overview-timeseries.js";

export type OverviewCompareMode = "previous" | "week-ago";

export type OverviewHealth = {
  status: "operational" | "degraded" | "outage";
  statusLabel: string;
  subtitle: string;
  errorRatePct: number;
  errorRateDeltaPct: number;
  successRatePct: number;
  throughputPerSec: number;
  peakThroughputPerSec: number;
};

export type OverviewActiveIssue = {
  id: string;
  severity: "P1" | "P3";
  title: string;
  meta: string;
  status: string;
  href: string;
};

export type OverviewWorkspaceTelemetry = {
  ingestRequests: number;
  sdkEventRows: number;
  distinctApps: number;
  distinctSdkVersions: number;
};

type Scope = {
  projectId: string;
  since: Date;
  app?: string;
  environment?: string;
};

function eventScopeWhere(scope: Scope): Prisma.EventWhereInput {
  const where: Prisma.EventWhereInput = {
    project_id: scope.projectId,
    created_at: { gte: scope.since },
  } as Prisma.EventWhereInput;
  if (scope.app) (where as { app?: string }).app = scope.app;
  if (scope.environment) (where as { environment?: string }).environment = scope.environment;
  return where;
}

function sessionScopeWhere(scope: Scope): Prisma.SessionWhereInput {
  const where: Prisma.SessionWhereInput = {
    project_id: scope.projectId,
    started_at: { gte: scope.since },
  } as Prisma.SessionWhereInput;
  if (scope.app) (where as { app?: string }).app = scope.app;
  return where;
}

function errorGroupScopeWhere(scope: Scope): Prisma.ErrorGroupWhereInput {
  const where: Prisma.ErrorGroupWhereInput = {
    project_id: scope.projectId,
    last_seen: { gte: scope.since },
  } as Prisma.ErrorGroupWhereInput;
  if (scope.app) (where as { app?: string }).app = scope.app;
  if (scope.environment) (where as { environment?: string }).environment = scope.environment;
  return where;
}

function errorOccurrenceScopeSql(
  projectId: string,
  gte: Date,
  lt: Date | undefined,
  app?: string,
  environment?: string
): Prisma.Sql {
  const timeClause =
    lt === undefined
      ? Prisma.sql`eo."created_at" >= ${gte}`
      : Prisma.sql`eo."created_at" >= ${gte} AND eo."created_at" < ${lt}`;
  const appClause = app ? Prisma.sql`AND eg."app" = ${app}` : Prisma.empty;
  const envClause = environment
    ? Prisma.sql`AND eg."environment" = ${environment}`
    : Prisma.empty;
  return Prisma.sql`
    eg."project_id" = ${projectId}
    AND ${timeClause}
    ${appClause}
    ${envClause}
  `;
}

export function resolveCompareWindow(
  range: "24h" | "7d",
  compare: OverviewCompareMode
): { previousSince: Date; previousUntil: Date | undefined } {
  const hours = range === "7d" ? 7 * 24 : 24;
  const ms = hours * 60 * 60 * 1000;
  const since = new Date(Date.now() - ms);
  if (compare === "week-ago" && range === "24h") {
    const weekAgoEnd = new Date(since.getTime() - 6 * 24 * 60 * 60 * 1000);
    const weekAgoStart = new Date(weekAgoEnd.getTime() - ms);
    return { previousSince: weekAgoStart, previousUntil: weekAgoEnd };
  }
  const previousSince = new Date(since.getTime() - ms);
  return { previousSince, previousUntil: since };
}

export async function countSessions(
  prisma: PrismaClient,
  scope: Scope,
  until?: Date
): Promise<number> {
  const where = sessionScopeWhere(scope);
  if (until) {
    (where as { started_at: { gte: Date; lt: Date } }).started_at = {
      gte: scope.since,
      lt: until,
    };
  }
  return prisma.session.count({ where });
}

export async function countActiveUsers(
  prisma: PrismaClient,
  scope: Scope,
  until?: Date
): Promise<number> {
  const appClause = scope.app ? Prisma.sql`AND e."app" = ${scope.app}` : Prisma.empty;
  const envClause = scope.environment
    ? Prisma.sql`AND e."environment" = ${scope.environment}`
    : Prisma.empty;
  const untilClause =
    until === undefined
      ? Prisma.empty
      : Prisma.sql`AND e."created_at" < ${until}`;

  const rows = await prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS c FROM (
      SELECT DISTINCT COALESCE(e."user_id", e."anonymous_id") AS uid
      FROM "Event" e
      WHERE e."project_id" = ${scope.projectId}
        AND e."created_at" >= ${scope.since}
        ${untilClause}
        AND (e."user_id" IS NOT NULL OR e."anonymous_id" IS NOT NULL)
        ${appClause}
        ${envClause}
    ) t
  `);
  return Number(rows[0]?.c ?? 0);
}

export async function listDistinctEnvironments(
  prisma: PrismaClient,
  projectId: string,
  app?: string
): Promise<string[]> {
  const base: Prisma.EventWhereInput = {
    project_id: projectId,
    environment: { not: null },
  } as Prisma.EventWhereInput;
  if (app) (base as { app?: string }).app = app;
  const rows = await prisma.event.groupBy({
    by: ["environment"],
    where: base,
  });
  return rows
    .map((r) => r.environment)
    .filter((x): x is string => x != null && x !== "")
    .sort();
}

export async function getSessionDurationSeries(
  prisma: PrismaClient,
  projectId: string,
  rangeLabel: "24h" | "7d",
  since: Date,
  app?: string
): Promise<OverviewTimeSeriesPoint[]> {
  const trunc = rangeLabel === "7d" ? "day" : "hour";
  const appClause = app ? Prisma.sql`AND s."app" = ${app}` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ bucket: Date; avg_sec: number | null }[]>(Prisma.sql`
    SELECT
      (date_trunc(${trunc}, s."started_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      AVG(EXTRACT(EPOCH FROM (s."ended_at" - s."started_at"))) AS avg_sec
    FROM "Session" s
    WHERE s."project_id" = ${projectId}
      AND s."started_at" >= ${since}
      AND s."ended_at" IS NOT NULL
      ${appClause}
    GROUP BY 1
    ORDER BY 1
  `);

  return rows.map((r) => ({
    t: r.bucket.toISOString(),
    count: Math.round(Number(r.avg_sec ?? 0)),
  }));
}

export async function getWorkspaceTelemetry(
  prisma: PrismaClient,
  projectId: string,
  since: Date,
  app?: string,
  environment?: string
): Promise<OverviewWorkspaceTelemetry> {
  const eventWhere = eventScopeWhere({ projectId, since, app, environment });
  const [events, errors, apps, sdkVersions] = await Promise.all([
    prisma.event.count({ where: eventWhere }),
    prisma.errorOccurrence.count({
      where: {
        created_at: { gte: since },
        error_group: {
          project_id: projectId,
          ...(app ? { app } : {}),
          ...(environment ? { environment } : {}),
        },
      } as Prisma.ErrorOccurrenceWhereInput,
    }),
    prisma.event.groupBy({
      by: ["app"],
      where: { project_id: projectId, created_at: { gte: since } } as Prisma.EventWhereInput,
    }),
    prisma.event.groupBy({
      by: ["sdk_version"],
      where: {
        ...eventWhere,
        sdk_version: { not: null },
      } as Prisma.EventWhereInput,
    }),
  ]);

  return {
    ingestRequests: events + errors,
    sdkEventRows: events,
    distinctApps: apps.length,
    distinctSdkVersions: sdkVersions.filter((r) => r.sdk_version).length,
  };
}

export function computeOverviewHealth(
  events: number,
  errors: number,
  eventsPrevious: number,
  errorsPrevious: number,
  seriesEvents: OverviewTimeSeriesPoint[]
): OverviewHealth {
  const total = events + errors;
  const totalPrev = eventsPrevious + errorsPrevious;
  const errorRatePct = total > 0 ? (errors / total) * 100 : 0;
  const prevErrorRatePct = totalPrev > 0 ? (errorsPrevious / totalPrev) * 100 : 0;
  const errorRateDeltaPct = errorRatePct - prevErrorRatePct;
  const successRatePct = total > 0 ? (events / total) * 100 : 100;

  const hourSeconds = 3600;
  const throughputs = seriesEvents.map((p) => p.count / hourSeconds);
  const peakThroughputPerSec = throughputs.length ? Math.max(...throughputs) : 0;
  const avgThroughputPerSec =
    throughputs.length > 0
      ? throughputs.reduce((a, b) => a + b, 0) / throughputs.length
      : 0;

  let status: OverviewHealth["status"] = "operational";
  let statusLabel = "Operational";
  if (errorRatePct >= 5) {
    status = "outage";
    statusLabel = "Elevated errors";
  } else if (errorRatePct >= 1) {
    status = "degraded";
    statusLabel = "Degraded";
  }

  const subtitle =
    total === 0
      ? "No telemetry in this period"
      : `${errors.toLocaleString()} errors · ${events.toLocaleString()} events`;

  return {
    status,
    statusLabel,
    subtitle,
    errorRatePct,
    errorRateDeltaPct,
    successRatePct,
    throughputPerSec: avgThroughputPerSec,
    peakThroughputPerSec,
  };
}

function relativeStarted(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "started just now";
  if (ms < 3600_000) return `started ${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `started ${Math.floor(ms / 3600_000)}h ago`;
  return `started ${Math.floor(ms / 86_400_000)}d ago`;
}

export async function listActiveIssues(
  prisma: PrismaClient,
  scope: Scope,
  limit = 5
): Promise<OverviewActiveIssue[]> {
  const groups = await prisma.errorGroup.findMany({
    where: {
      ...errorGroupScopeWhere(scope),
      resolved_at: null,
    },
    orderBy: { occurrences: "desc" },
    take: limit,
    select: {
      id: true,
      message: true,
      app: true,
      environment: true,
      occurrences: true,
      first_seen: true,
      last_seen: true,
    },
  });

  return groups.map((g) => {
    const severity: "P1" | "P3" = g.occurrences >= 25 ? "P1" : "P3";
    const envPart = g.environment ? ` · ${g.environment}` : "";
    return {
      id: g.id,
      severity,
      title: g.message,
      meta: `${relativeStarted(g.first_seen.toISOString())} · app ${g.app}${envPart} · ${g.occurrences} occurrences`,
      status: "Open",
      href: `/dashboard/errors/${g.id}`,
    };
  });
}

export async function countErrorsInWindow(
  prisma: PrismaClient,
  projectId: string,
  gte: Date,
  lt: Date | undefined,
  app?: string,
  environment?: string
): Promise<number> {
  const whereSql = errorOccurrenceScopeSql(projectId, gte, lt, app, environment);
  const rows = await prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS c
    FROM "ErrorOccurrence" eo
    INNER JOIN "ErrorGroup" eg ON eo."error_group_id" = eg.id
    WHERE ${whereSql}
  `);
  return Number(rows[0]?.c ?? 0);
}

export async function countEventsInWindow(
  prisma: PrismaClient,
  projectId: string,
  gte: Date,
  lt: Date | undefined,
  app?: string,
  environment?: string
): Promise<number> {
  const where: Prisma.EventWhereInput = {
    project_id: projectId,
    created_at: lt ? { gte, lt } : { gte },
  } as Prisma.EventWhereInput;
  if (app) (where as { app?: string }).app = app;
  if (environment) (where as { environment?: string }).environment = environment;
  return prisma.event.count({ where });
}
