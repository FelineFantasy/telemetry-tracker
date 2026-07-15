/**
 * Overview KPI sparklines, Node `$request` latency / Apdex, and recent sessions.
 */
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  generateOverviewChartBuckets,
  overviewChartQuerySince,
  type OverviewSeriesBucket,
  type OverviewTimeSeriesPoint,
} from "./overview-timeseries.js";
import {
  listSessionsEnriched,
  serializeSessionListItem,
} from "./sessions-list-query.js";
import {
  buildSessionListFilter,
  type SessionListFilterInput,
} from "./sessions-page-summary.js";

export const REQUEST_EVENT_NAME = "$request";
export const REQUEST_APDEX_THRESHOLD_MS = 300;

export type OverviewSparklinePoint = {
  t: string;
  count: number | null;
};

export type OverviewKpiSparklines = {
  errors: OverviewSparklinePoint[];
  events: OverviewSparklinePoint[];
  sessions: OverviewSparklinePoint[];
};

export type OverviewRequestMetrics = {
  available: false;
} | {
  available: true;
  avgResponseMs: number;
  avgResponseMsPrevious: number | null;
  apdex: number;
  apdexPrevious: number | null;
  requestCount: number;
  sparklines: {
    avgResponseMs: OverviewSparklinePoint[];
    apdexPct: OverviewSparklinePoint[];
  };
};

export type OverviewRecentSession = {
  id: string;
  session_id: string;
  app: string;
  user_id: string | null;
  anonymous_id: string | null;
  user_email: string | null;
  started_at: string;
  duration_sec: number;
  event_count: number;
  status: "healthy" | "warning";
};

export type OverviewTopErrorGroup = {
  id: string;
  message: string;
  app: string;
  occurrences: number;
  last_seen: string;
};

type Scope = {
  projectId: string;
  since: Date;
  until: Date;
  app?: string;
  environment?: string;
  platform?: string;
  release?: string;
};

function eventScopeSql(scope: Scope): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`e."project_id" = ${scope.projectId}`];
  if (scope.app) parts.push(Prisma.sql`e."app" = ${scope.app}`);
  if (scope.environment) parts.push(Prisma.sql`e."environment" = ${scope.environment}`);
  if (scope.platform) parts.push(Prisma.sql`e."platform" = ${scope.platform}`);
  if (scope.release) parts.push(Prisma.sql`e."release" = ${scope.release}`);
  return Prisma.join(parts, " AND ");
}

/** Numeric `duration_ms` from `$request` event properties, or NULL when absent/invalid. */
export function requestDurationMsExpr(alias = "e"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`CASE
    WHEN ${a}."properties"->>'duration_ms' ~ '^[0-9]+(\.[0-9]+)?$'
    THEN (${a}."properties"->>'duration_ms')::double precision
  END`;
}

/** Apdex score in [0, 1] from satisfied / tolerating / total counts. */
export function apdexScore(
  satisfied: number,
  tolerating: number,
  total: number
): number {
  if (total <= 0) return 1;
  return (satisfied + tolerating / 2) / total;
}

export function apdexPctFromScore(score: number): number {
  return Math.round(score * 1000) / 10;
}

/** Bucket sparkline value — null when the bucket has no `$request` samples. */
export function apdexPctForBucket(
  satisfied: number,
  tolerating: number,
  total: number
): number | null {
  if (total <= 0) return null;
  return apdexPctFromScore(apdexScore(satisfied, tolerating, total));
}

/** Bucket sparkline value — null when the bucket has no timed `$request` samples. */
export function avgResponseMsForBucket(
  avgMs: number | null | undefined,
  sampleCount: number
): number | null {
  if (sampleCount <= 0 || avgMs == null) return null;
  return Math.round(avgMs);
}

/** Scalar compare value — null when the window has no timed `$request` samples. */
export function avgResponseMsForWindow(
  avgMs: number | null | undefined,
  sampleCount: number
): number | null {
  return avgResponseMsForBucket(avgMs, sampleCount);
}

function apdexBucketComponentsExpr(
  durationExpr: Prisma.Sql,
  thresholdMs: number
): Prisma.Sql {
  const toleratingMax = thresholdMs * 4;
  return Prisma.sql`
    COUNT(*) FILTER (
      WHERE ${durationExpr} IS NOT NULL AND ${durationExpr} <= ${thresholdMs}
    )::bigint AS satisfied,
    COUNT(*) FILTER (
      WHERE ${durationExpr} IS NOT NULL
        AND ${durationExpr} > ${thresholdMs}
        AND ${durationExpr} <= ${toleratingMax}
    )::bigint AS tolerating,
    COUNT(*) FILTER (
      WHERE ${durationExpr} IS NOT NULL
    )::bigint AS total
  `;
}

export function sparklinesFromTimeSeries(series: {
  errors: OverviewTimeSeriesPoint[];
  events: OverviewTimeSeriesPoint[];
  sessions: OverviewTimeSeriesPoint[];
}): OverviewKpiSparklines {
  return {
    errors: series.errors,
    events: series.events,
    sessions: series.sessions,
  };
}

type RequestScalarRow = {
  avg_response_ms: number | null;
  avg_response_ms_previous: number | null;
  satisfied: bigint;
  tolerating: bigint;
  total: bigint;
  satisfied_previous: bigint;
  tolerating_previous: bigint;
  total_previous: bigint;
};

type RequestBucketRow = {
  bucket: Date;
  avg_response_ms: number | null;
  satisfied: bigint;
  tolerating: bigint;
  total: bigint;
};

export async function fetchOverviewRequestMetrics(
  prisma: PrismaClient,
  scope: Scope,
  previousSince: Date,
  previousUntil: Date,
  bucket: OverviewSeriesBucket,
  thresholdMs = REQUEST_APDEX_THRESHOLD_MS
): Promise<OverviewRequestMetrics> {
  const { since, until } = scope;
  const filters = eventScopeSql(scope);
  const duration = requestDurationMsExpr("e");
  const currentWindow = Prisma.sql`e."created_at" >= ${since} AND e."created_at" <= ${until}`;
  const previousWindow = Prisma.sql`e."created_at" >= ${previousSince} AND e."created_at" < ${previousUntil}`;
  const queryLowerBound = previousSince;
  const trunc = bucket === "week" ? "week" : bucket;
  const chartSince = overviewChartQuerySince(since, until, bucket);

  const [scalarRows, bucketRows] = await Promise.all([
    prisma.$queryRaw<[RequestScalarRow]>(Prisma.sql`
      SELECT
        AVG(${duration}) FILTER (WHERE ${currentWindow}) AS avg_response_ms,
        AVG(${duration}) FILTER (WHERE ${previousWindow}) AS avg_response_ms_previous,
        COUNT(*) FILTER (
          WHERE ${currentWindow} AND ${duration} IS NOT NULL AND ${duration} <= ${thresholdMs}
        )::bigint AS satisfied,
        COUNT(*) FILTER (
          WHERE ${currentWindow}
            AND ${duration} IS NOT NULL
            AND ${duration} > ${thresholdMs}
            AND ${duration} <= ${thresholdMs * 4}
        )::bigint AS tolerating,
        COUNT(*) FILTER (
          WHERE ${currentWindow} AND ${duration} IS NOT NULL
        )::bigint AS total,
        COUNT(*) FILTER (
          WHERE ${previousWindow} AND ${duration} IS NOT NULL AND ${duration} <= ${thresholdMs}
        )::bigint AS satisfied_previous,
        COUNT(*) FILTER (
          WHERE ${previousWindow}
            AND ${duration} IS NOT NULL
            AND ${duration} > ${thresholdMs}
            AND ${duration} <= ${thresholdMs * 4}
        )::bigint AS tolerating_previous,
        COUNT(*) FILTER (
          WHERE ${previousWindow} AND ${duration} IS NOT NULL
        )::bigint AS total_previous
      FROM "Event" e
      WHERE ${filters}
        AND e."name" = ${REQUEST_EVENT_NAME}
        AND e."created_at" >= ${queryLowerBound}
        AND e."created_at" <= ${until}
    `),
    prisma.$queryRaw<RequestBucketRow[]>(Prisma.sql`
      SELECT
        (date_trunc(${trunc}, e."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
        AVG(${duration}) AS avg_response_ms,
        COUNT(*) FILTER (
          WHERE ${duration} IS NOT NULL AND ${duration} <= ${thresholdMs}
        )::bigint AS satisfied,
        COUNT(*) FILTER (
          WHERE ${duration} IS NOT NULL
            AND ${duration} > ${thresholdMs}
            AND ${duration} <= ${thresholdMs * 4}
        )::bigint AS tolerating,
        COUNT(*) FILTER (
          WHERE ${duration} IS NOT NULL
        )::bigint AS total
      FROM "Event" e
      WHERE ${filters}
        AND e."name" = ${REQUEST_EVENT_NAME}
        AND e."created_at" >= ${chartSince}
        AND e."created_at" <= ${until}
      GROUP BY 1
      ORDER BY 1
    `),
  ]);

  const row = scalarRows[0];
  const requestCount = Number(row?.total ?? 0);
  if (requestCount === 0) {
    return { available: false };
  }

  const byBucket = new Map(bucketRows.map((r) => [r.bucket.toISOString(), r]));
  const buckets = generateOverviewChartBuckets(chartSince, until, bucket);

  const avgResponseMs = Math.round(Number(row?.avg_response_ms ?? 0));
  const previousRequestCount = Number(row?.total_previous ?? 0);
  const avgResponseMsPrevious = avgResponseMsForWindow(
    row?.avg_response_ms_previous,
    previousRequestCount
  );
  const apdex = apdexScore(
    Number(row?.satisfied ?? 0),
    Number(row?.tolerating ?? 0),
    requestCount
  );
  const apdexPrevious =
    previousRequestCount === 0
      ? null
      : apdexScore(
          Number(row?.satisfied_previous ?? 0),
          Number(row?.tolerating_previous ?? 0),
          previousRequestCount
        );

  return {
    available: true,
    avgResponseMs,
    avgResponseMsPrevious,
    apdex,
    apdexPrevious,
    requestCount,
    sparklines: {
      avgResponseMs: buckets.map((bucketDate) => {
        const t = bucketDate.toISOString();
        const bucketRow = byBucket.get(t);
        return {
          t,
          count: avgResponseMsForBucket(
            bucketRow?.avg_response_ms,
            Number(bucketRow?.total ?? 0)
          ),
        };
      }),
      apdexPct: buckets.map((bucketDate) => {
        const t = bucketDate.toISOString();
        const bucketRow = byBucket.get(t);
        const pct = apdexPctForBucket(
          Number(bucketRow?.satisfied ?? 0),
          Number(bucketRow?.tolerating ?? 0),
          Number(bucketRow?.total ?? 0)
        );
        return { t, count: pct };
      }),
    },
  };
}

/** @internal Exported for unit tests. */
export function overviewTopErrorGroupsInWindowSql(
  projectId: string,
  scope: Pick<Scope, "app" | "environment" | "platform" | "release">,
  window: { gte: Date; lte: Date },
  limit: number
): Prisma.Sql {
  const appClause = scope.app ? Prisma.sql`AND eg."app" = ${scope.app}` : Prisma.empty;
  const envClause = scope.environment
    ? Prisma.sql`AND eg."environment" = ${scope.environment}`
    : Prisma.empty;
  const platformClause = scope.platform
    ? Prisma.sql`AND eo."platform" = ${scope.platform}`
    : Prisma.empty;
  const releaseClause = scope.release
    ? Prisma.sql`AND eo."release" = ${scope.release}`
    : Prisma.empty;
  return Prisma.sql`
    SELECT
      eg.id,
      eg.message,
      eg.app,
      COUNT(eo.id)::bigint AS occurrences,
      MAX(eo."created_at") AS last_seen
    FROM "ErrorGroup" eg
    INNER JOIN "ErrorOccurrence" eo ON eo."error_group_id" = eg.id
    WHERE eg."project_id" = ${projectId}
      AND eo."created_at" >= ${window.gte}
      AND eo."created_at" <= ${window.lte}
      ${appClause}
      ${envClause}
      ${platformClause}
      ${releaseClause}
    GROUP BY eg.id, eg.message, eg.app
    ORDER BY occurrences DESC, last_seen DESC
    LIMIT ${limit}
  `;
}

export async function listOverviewTopErrorGroups(
  prisma: PrismaClient,
  scope: Scope,
  limit = 8
): Promise<OverviewTopErrorGroup[]> {
  const window = { gte: scope.since, lte: scope.until };
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      message: string;
      app: string;
      occurrences: bigint;
      last_seen: Date;
    }>
  >(overviewTopErrorGroupsInWindowSql(scope.projectId, scope, window, limit));

  return rows.map((row) => ({
    id: row.id,
    message: row.message,
    app: row.app,
    occurrences: Number(row.occurrences),
    last_seen: row.last_seen.toISOString(),
  }));
}

export async function listOverviewRecentSessions(
  prisma: PrismaClient,
  filter: SessionListFilterInput,
  projectId: string,
  startedAt: { gte: Date; lte: Date },
  limit = 8
): Promise<OverviewRecentSession[]> {
  const { rows } = await listSessionsEnriched(
    prisma,
    filter,
    projectId,
    startedAt,
    "started_at",
    "desc",
    0,
    limit
  );

  return rows.map((row) => {
    const serialized = serializeSessionListItem(row);
    return {
      id: String(serialized.id),
      session_id: String(serialized.session_id),
      app: String(serialized.app),
      user_id: (serialized.user_id as string | null) ?? null,
      anonymous_id: (serialized.anonymous_id as string | null) ?? null,
      user_email: (serialized.user_email as string | null) ?? null,
      started_at: String(serialized.started_at),
      duration_sec: Number(serialized.duration_sec),
      event_count: Number(serialized.event_count),
      status: serialized.status as "healthy" | "warning",
    };
  });
}

export function buildOverviewSessionFilter(
  scope: Pick<Scope, "app" | "environment" | "platform" | "release">,
  range: { gte: Date; lte: Date }
): SessionListFilterInput {
  return buildSessionListFilter({
    appId: scope.app,
    environment: scope.environment,
    platform: scope.platform,
    release: scope.release,
    range,
  });
}

/** @internal Exported for tests — unused in production query path. */
export function apdexBucketComponentsSql(
  durationExpr: Prisma.Sql,
  thresholdMs: number
): Prisma.Sql {
  return apdexBucketComponentsExpr(durationExpr, thresholdMs);
}
