/**
 * Sessions list page summary KPIs and shared filter-scope helpers.
 *
 * Product rules:
 * - **Bounce session**: duration under 10s (when ended) OR exactly one event for the session.
 * - **Crash-free session**: no ErrorOccurrence rows with matching session_id.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { escapeLikePattern } from "./list-query.js";
import { generateOverviewChartBuckets, overviewChartQuerySince } from "./overview-timeseries.js";
import { resolveCompareWindow } from "./overview-stats.js";
import { chooseTimeRangeBucket } from "./time-range.js";

export const BOUNCE_MAX_DURATION_SECONDS = 10;

export type SessionListFilterInput = {
  appId?: string;
  platform?: string;
  environment?: string;
  release?: string;
  country?: string;
  /** Search user id, email, country, or device fields. */
  q?: string;
  range: { gte?: Date; lte?: Date };
};

export function buildSessionListFilter(input: {
  appId?: string;
  platform?: string;
  environment?: string;
  release?: string;
  country?: string;
  q?: string;
  range: { gte?: Date; lte?: Date };
}): SessionListFilterInput {
  const filter: SessionListFilterInput = { range: input.range };
  if (input.appId) filter.appId = input.appId;
  if (input.platform) filter.platform = input.platform;
  if (input.environment) filter.environment = input.environment;
  if (input.release) filter.release = input.release;
  if (input.country) filter.country = input.country;
  if (input.q?.trim()) filter.q = input.q.trim();
  return filter;
}

export type SessionsSummarySparklinePoint = {
  t: string;
  count: number;
};

export type SessionsPageSummary = {
  window: {
    since: string;
    until: string;
    label: string;
    compareLabel: string;
  };
  totalSessions: number;
  totalSessionsPrevious: number;
  distinctUsers: number;
  distinctUsersPrevious: number;
  avgDurationSec: number;
  avgDurationSecPrevious: number;
  bounceRatePct: number;
  bounceRatePctPrevious: number;
  crashFreeRatePct: number;
  crashFreeRatePctPrevious: number;
  sparklines: {
    totalSessions: SessionsSummarySparklinePoint[];
    distinctUsers: SessionsSummarySparklinePoint[];
    avgDurationSec: SessionsSummarySparklinePoint[];
    bounceRatePct: SessionsSummarySparklinePoint[];
    crashFreeRatePct: SessionsSummarySparklinePoint[];
  };
};

export type ResolvedSummaryWindow = {
  since: Date;
  until: Date;
  previousSince: Date;
  previousUntil: Date;
  label: string;
  compareLabel: string;
};

const DEFAULT_SUMMARY_MS = 7 * 24 * 60 * 60 * 1000;

export function parseSessionsMetricsAnchor(value: string | undefined): Date {
  const raw = value?.trim();
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/** Resolve KPI window from list filters; defaults to last 7 days when range is all-time or open-ended. */
export function resolveSessionsSummaryWindow(
  range: { gte?: Date; lte?: Date },
  anchor: Date = new Date()
): ResolvedSummaryWindow {
  const until = range.lte ?? anchor;
  const since =
    range.gte ?? new Date(until.getTime() - DEFAULT_SUMMARY_MS);
  const durationMs = Math.max(until.getTime() - since.getTime(), 1);
  const { previousSince, previousUntil } = resolveCompareWindow(
    durationMs,
    "previous",
    since,
    until
  );
  const prevUntil = previousUntil ?? since;
  const label = range.gte ? "Selected period" : "Last 7 days";
  return {
    since,
    until,
    previousSince,
    previousUntil: prevUntil,
    label,
    compareLabel: "vs prior period",
  };
}

/** started_at bounds for list queries — aligned with summary KPI window. */
export function resolveSessionListStartedAtBounds(
  range: { gte?: Date; lte?: Date },
  anchor: Date = new Date()
): { gte: Date; lte: Date } {
  const w = resolveSessionsSummaryWindow(range, anchor);
  return {
    gte: range.gte ?? w.since,
    lte: range.lte ?? w.until,
  };
}

function sessionStartedInCurrentWindow(
  alias: string,
  since: Date,
  until: Date
): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`${a}."started_at" >= ${since} AND ${a}."started_at" <= ${until}`;
}

function sessionStartedInPreviousWindow(
  alias: string,
  previousSince: Date,
  previousUntil: Date
): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`${a}."started_at" >= ${previousSince} AND ${a}."started_at" < ${previousUntil}`;
}

export function sessionHasNoProjectErrorsSql(
  projectId: string,
  sessionAlias = "s"
): Prisma.Sql {
  const s = Prisma.raw(`"${sessionAlias}"`);
  return Prisma.sql`NOT EXISTS (
    SELECT 1 FROM "ErrorOccurrence" eo
    INNER JOIN "ErrorGroup" eg ON eg."id" = eo."error_group_id"
    WHERE eo."session_id" = ${s}."session_id"
      AND eg."project_id" = ${projectId}
  )`;
}

function sessionIdentityExpr(alias = "s"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`COALESCE(
    NULLIF(TRIM(COALESCE(${a}."user_id", '')), ''),
    NULLIF(TRIM(COALESCE(${a}."anonymous_id", '')), '')
  )`;
}

function sessionEventScopeClauses(f: SessionListFilterInput): Prisma.Sql[] {
  const eventClauses: Prisma.Sql[] = [];
  if (f.environment) {
    eventClauses.push(Prisma.sql`e."environment" = ${f.environment}`);
  }
  if (f.release) {
    eventClauses.push(Prisma.sql`e."release" = ${f.release}`);
  }
  return eventClauses;
}

function sessionHasEventScope(f: SessionListFilterInput): boolean {
  return sessionEventScopeClauses(f).length > 0;
}

export type SessionEventWindow = {
  gte?: Date;
  lte?: Date;
  exclusiveLte?: boolean;
};

function sessionEventExistsSql(
  projectId: string,
  sessionAlias: string,
  extra: Prisma.Sql[] = [],
  eventWindow?: SessionEventWindow
): Prisma.Sql {
  const s = Prisma.raw(`"${sessionAlias}"`);
  const clauses =
    extra.length > 0
      ? Prisma.sql` AND ${Prisma.join(extra, " AND ")}`
      : Prisma.empty;
  const windowParts: Prisma.Sql[] = [];
  if (eventWindow?.gte) {
    windowParts.push(Prisma.sql`e."created_at" >= ${eventWindow.gte}`);
  }
  if (eventWindow?.lte) {
    windowParts.push(
      eventWindow.exclusiveLte
        ? Prisma.sql`e."created_at" < ${eventWindow.lte}`
        : Prisma.sql`e."created_at" <= ${eventWindow.lte}`
    );
  }
  const windowClause =
    windowParts.length > 0
      ? Prisma.sql` AND ${Prisma.join(windowParts, " AND ")}`
      : Prisma.empty;
  return Prisma.sql`EXISTS (
    SELECT 1 FROM "Event" e
    WHERE e."project_id" = ${projectId}
      AND e."session_id" = ${s}."session_id"
      AND e."app" = ${s}."app"
      ${clauses}
      ${windowClause}
  )`;
}

function resolveSessionEventWindow(
  f: SessionListFilterInput,
  eventWindow?: SessionEventWindow
): SessionEventWindow | undefined {
  if (eventWindow?.gte || eventWindow?.lte) return eventWindow;
  if (f.range.gte || f.range.lte) return { gte: f.range.gte, lte: f.range.lte };
  return undefined;
}

/** @internal Exported for unit tests. */
export function sessionWindowWithEventScope(
  projectId: string,
  f: SessionListFilterInput,
  sessionAlias: string,
  since: Date,
  until: Date,
  exclusiveUntil = false
): Prisma.Sql {
  const startedAt = exclusiveUntil
    ? sessionStartedInPreviousWindow(sessionAlias, since, until)
    : sessionStartedInCurrentWindow(sessionAlias, since, until);
  const eventClauses = sessionEventScopeClauses(f);
  if (eventClauses.length === 0) return startedAt;
  return Prisma.sql`(${startedAt} AND ${sessionEventExistsSql(
    projectId,
    sessionAlias,
    eventClauses,
    { gte: since, lte: until, exclusiveLte: exclusiveUntil }
  )})`;
}

function sessionSearchSql(q: string): Prisma.Sql {
  const pat = `%${escapeLikePattern(q.trim())}%`;
  return Prisma.sql`(
    COALESCE(s."user_id", '') ILIKE ${pat} ESCAPE '\\'
    OR COALESCE(s."anonymous_id", '') ILIKE ${pat} ESCAPE '\\'
    OR COALESCE(s."user_email", '') ILIKE ${pat} ESCAPE '\\'
    OR COALESCE(s."country", '') ILIKE ${pat} ESCAPE '\\'
    OR COALESCE(s."device_browser", '') ILIKE ${pat} ESCAPE '\\'
    OR COALESCE(s."device_os", '') ILIKE ${pat} ESCAPE '\\'
  )`;
}

export function sessionFilterSql(
  projectId: string,
  f: SessionListFilterInput,
  eventWindow?: SessionEventWindow,
  omitEventScope = false
): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`s."project_id" = ${projectId}`];
  if (f.appId) parts.push(Prisma.sql`s."app" = ${f.appId}`);
  if (f.platform) parts.push(Prisma.sql`s."platform" = ${f.platform}`);
  if (f.country) parts.push(Prisma.sql`s."country" = ${f.country}`);
  const eventClauses = sessionEventScopeClauses(f);
  if (eventClauses.length > 0 && !omitEventScope) {
    parts.push(
      sessionEventExistsSql(
        projectId,
        "s",
        eventClauses,
        resolveSessionEventWindow(f, eventWindow)
      )
    );
  }
  if (f.q?.trim()) parts.push(sessionSearchSql(f.q));
  return Prisma.join(parts, " AND ");
}

type SummaryRow = {
  total_sessions: bigint;
  total_sessions_previous: bigint;
  distinct_users: bigint;
  distinct_users_previous: bigint;
  avg_duration_sec: number | null;
  avg_duration_sec_previous: number | null;
  bounce_sessions: bigint;
  bounce_sessions_previous: bigint;
  crash_free_sessions: bigint;
  crash_free_sessions_previous: bigint;
};

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

async function fetchSessionSummaryScalars(
  prisma: PrismaClient,
  f: SessionListFilterInput,
  projectId: string,
  window: ResolvedSummaryWindow
): Promise<SummaryRow> {
  const { since, until, previousSince, previousUntil } = window;
  const filters = sessionFilterSql(projectId, f, undefined, sessionHasEventScope(f));
  const identity = sessionIdentityExpr("s");
  const bounceSec = BOUNCE_MAX_DURATION_SECONDS;
  const currentWindow = sessionWindowWithEventScope(
    projectId,
    f,
    "s",
    since,
    until
  );
  const previousWindow = sessionWindowWithEventScope(
    projectId,
    f,
    "s",
    previousSince,
    previousUntil,
    true
  );
  const noErrors = sessionHasNoProjectErrorsSql(projectId, "s");
  const queryLowerBound = new Date(
    Math.min(since.getTime(), previousSince.getTime())
  );

  const rows = await prisma.$queryRaw<[SummaryRow]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (
        WHERE ${currentWindow}
      )::bigint AS total_sessions,
      COUNT(*) FILTER (
        WHERE ${previousWindow}
      )::bigint AS total_sessions_previous,
      COUNT(DISTINCT ${identity}) FILTER (
        WHERE ${currentWindow}
      )::bigint AS distinct_users,
      COUNT(DISTINCT ${identity}) FILTER (
        WHERE ${previousWindow}
      )::bigint AS distinct_users_previous,
      AVG(EXTRACT(EPOCH FROM (s."ended_at" - s."started_at"))) FILTER (
        WHERE ${currentWindow}
          AND s."ended_at" IS NOT NULL
      ) AS avg_duration_sec,
      AVG(EXTRACT(EPOCH FROM (s."ended_at" - s."started_at"))) FILTER (
        WHERE ${previousWindow}
          AND s."ended_at" IS NOT NULL
      ) AS avg_duration_sec_previous,
      COUNT(*) FILTER (
        WHERE ${currentWindow}
          AND (
            (s."ended_at" IS NOT NULL
              AND EXTRACT(EPOCH FROM (s."ended_at" - s."started_at")) < ${bounceSec})
            OR COALESCE(ev.event_count, 0) = 1
          )
      )::bigint AS bounce_sessions,
      COUNT(*) FILTER (
        WHERE ${previousWindow}
          AND (
            (s."ended_at" IS NOT NULL
              AND EXTRACT(EPOCH FROM (s."ended_at" - s."started_at")) < ${bounceSec})
            OR COALESCE(ev.event_count, 0) = 1
          )
      )::bigint AS bounce_sessions_previous,
      COUNT(*) FILTER (
        WHERE ${currentWindow}
          AND ${noErrors}
      )::bigint AS crash_free_sessions,
      COUNT(*) FILTER (
        WHERE ${previousWindow}
          AND ${noErrors}
      )::bigint AS crash_free_sessions_previous
    FROM "Session" s
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS event_count
      FROM "Event" e
      WHERE e."project_id" = s."project_id"
        AND e."session_id" = s."session_id"
        AND e."app" = s."app"
    ) ev ON TRUE
    WHERE ${filters}
      AND s."started_at" >= ${queryLowerBound}
      AND s."started_at" <= ${until}
  `);

  return rows[0] ?? {
    total_sessions: 0n,
    total_sessions_previous: 0n,
    distinct_users: 0n,
    distinct_users_previous: 0n,
    avg_duration_sec: null,
    avg_duration_sec_previous: null,
    bounce_sessions: 0n,
    bounce_sessions_previous: 0n,
    crash_free_sessions: 0n,
    crash_free_sessions_previous: 0n,
  };
}

type SparklineBucketRow = {
  bucket: Date;
  total_sessions: bigint;
  distinct_users: bigint;
  avg_duration_sec: number | null;
  bounce_sessions: bigint;
  crash_free_sessions: bigint;
};

async function fetchSessionSummarySparklines(
  prisma: PrismaClient,
  f: SessionListFilterInput,
  projectId: string,
  window: ResolvedSummaryWindow
): Promise<SessionsPageSummary["sparklines"]> {
  const { since, until } = window;
  const durationMs = Math.max(until.getTime() - since.getTime(), 1);
  const { bucket } = chooseTimeRangeBucket(durationMs);
  const trunc = bucket === "week" ? "week" : bucket;
  const chartSince = overviewChartQuerySince(since, until, bucket);
  const filters = sessionFilterSql(projectId, f, { gte: chartSince, lte: until });
  const identity = sessionIdentityExpr("s");
  const bounceSec = BOUNCE_MAX_DURATION_SECONDS;
  const noErrors = sessionHasNoProjectErrorsSql(projectId, "s");

  const rows = await prisma.$queryRaw<SparklineBucketRow[]>(Prisma.sql`
    SELECT
      (date_trunc(${trunc}, s."started_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      COUNT(*)::bigint AS total_sessions,
      COUNT(DISTINCT ${identity})::bigint AS distinct_users,
      AVG(EXTRACT(EPOCH FROM (s."ended_at" - s."started_at"))) FILTER (
        WHERE s."ended_at" IS NOT NULL
      ) AS avg_duration_sec,
      COUNT(*) FILTER (
        WHERE (s."ended_at" IS NOT NULL
          AND EXTRACT(EPOCH FROM (s."ended_at" - s."started_at")) < ${bounceSec})
          OR COALESCE(ev.event_count, 0) = 1
      )::bigint AS bounce_sessions,
      COUNT(*) FILTER (
        WHERE ${noErrors}
      )::bigint AS crash_free_sessions
    FROM "Session" s
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS event_count
      FROM "Event" e
      WHERE e."project_id" = s."project_id"
        AND e."session_id" = s."session_id"
        AND e."app" = s."app"
    ) ev ON TRUE
    WHERE ${filters}
      AND s."started_at" >= ${chartSince}
      AND s."started_at" <= ${until}
    GROUP BY 1
    ORDER BY 1
  `);

  const buckets = generateOverviewChartBuckets(chartSince, until, bucket);
  const byBucket = new Map(
    rows.map((r) => [r.bucket.toISOString(), r])
  );

  const pick = (
    mapper: (r: SparklineBucketRow | undefined, total: number) => number
  ): SessionsSummarySparklinePoint[] =>
    buckets.map((bucketDate) => {
      const t = bucketDate.toISOString();
      const row = byBucket.get(t);
      const total = Number(row?.total_sessions ?? 0);
      return { t, count: mapper(row, total) };
    });

  return {
    totalSessions: pick((r) => Number(r?.total_sessions ?? 0)),
    distinctUsers: pick((r) => Number(r?.distinct_users ?? 0)),
    avgDurationSec: pick((r) => Math.round(Number(r?.avg_duration_sec ?? 0))),
    bounceRatePct: pick((r, total) =>
      pct(Number(r?.bounce_sessions ?? 0), total)
    ),
    crashFreeRatePct: pick((r, total) =>
      pct(Number(r?.crash_free_sessions ?? 0), total)
    ),
  };
}

export async function fetchSessionsPageSummary(
  prisma: PrismaClient,
  f: SessionListFilterInput,
  projectId: string,
  window: ResolvedSummaryWindow
): Promise<SessionsPageSummary> {
  const [row, sparklines] = await Promise.all([
    fetchSessionSummaryScalars(prisma, f, projectId, window),
    fetchSessionSummarySparklines(prisma, f, projectId, window),
  ]);

  const totalSessions = Number(row.total_sessions);
  const totalSessionsPrevious = Number(row.total_sessions_previous);
  const bounceRatePct = pct(Number(row.bounce_sessions), totalSessions);
  const bounceRatePctPrevious = pct(
    Number(row.bounce_sessions_previous),
    totalSessionsPrevious
  );
  const crashFreeRatePct = pct(Number(row.crash_free_sessions), totalSessions);
  const crashFreeRatePctPrevious = pct(
    Number(row.crash_free_sessions_previous),
    totalSessionsPrevious
  );

  return {
    window: {
      since: window.since.toISOString(),
      until: window.until.toISOString(),
      label: window.label,
      compareLabel: window.compareLabel,
    },
    totalSessions,
    totalSessionsPrevious,
    distinctUsers: Number(row.distinct_users),
    distinctUsersPrevious: Number(row.distinct_users_previous),
    avgDurationSec: Math.round(Number(row.avg_duration_sec ?? 0)),
    avgDurationSecPrevious: Math.round(Number(row.avg_duration_sec_previous ?? 0)),
    bounceRatePct,
    bounceRatePctPrevious,
    crashFreeRatePct,
    crashFreeRatePctPrevious,
    sparklines,
  };
}
