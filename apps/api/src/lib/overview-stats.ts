/**
 * Overview aggregates beyond the core error/event counts.
 */
import { Prisma } from "@prisma/client";
import { sessionUserIdentityExpr } from "./brief-snapshot-sql.js";
import {
  releaseFilterMatchSql,
  releasePrismaWhere,
  sessionEffectiveReleaseFilterSql,
} from "./release-key.js";
import type { PrismaClient } from "@prisma/client";
import {
  overviewChartQuerySince,
  type OverviewTimeSeriesPoint,
} from "./overview-timeseries.js";

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
  until?: Date;
  app?: string;
  environment?: string;
  platform?: string;
  release?: string;
};

function eventCreatedAtFilter(since: Date, until?: Date): { gte: Date; lte?: Date } {
  return until ? { gte: since, lte: until } : { gte: since };
}

function eventScopeWhere(scope: Scope): Prisma.EventWhereInput {
  const where: Prisma.EventWhereInput = {
    project_id: scope.projectId,
    created_at: eventCreatedAtFilter(scope.since, scope.until),
  } as Prisma.EventWhereInput;
  if (scope.app) (where as { app?: string }).app = scope.app;
  if (scope.environment) (where as { environment?: string }).environment = scope.environment;
  if (scope.platform) (where as { platform?: string }).platform = scope.platform;
  if (scope.release) (where as { release?: string }).release = scope.release;
  return where;
}

function sessionScopeWhere(scope: Scope): Prisma.SessionWhereInput {
  const where: Prisma.SessionWhereInput = {
    project_id: scope.projectId,
    started_at: scope.until
      ? { gte: scope.since, lte: scope.until }
      : { gte: scope.since },
  } as Prisma.SessionWhereInput;
  if (scope.app) (where as { app?: string }).app = scope.app;
  if (scope.platform) (where as { platform?: string }).platform = scope.platform;
  if (scope.environment) (where as { environment?: string }).environment = scope.environment;
  if (scope.release) Object.assign(where, releasePrismaWhere(scope.release));
  return where;
}

function errorGroupScopeWhere(scope: Scope): Prisma.ErrorGroupWhereInput {
  const where: Prisma.ErrorGroupWhereInput = {
    project_id: scope.projectId,
  } as Prisma.ErrorGroupWhereInput;
  if (scope.app) (where as { app?: string }).app = scope.app;
  if (scope.environment) (where as { environment?: string }).environment = scope.environment;
  if (scope.platform || scope.release) {
    // Membership follows in-window matching occurrences (same as scoped Overview list / KPIs).
    where.occurrences_list = {
      some: {
        created_at: scope.until
          ? { gte: scope.since, lte: scope.until }
          : { gte: scope.since },
        ...(scope.platform ? { platform: scope.platform } : {}),
        ...releasePrismaWhere(scope.release),
      },
    };
  } else {
    where.last_seen = scope.until
      ? { gte: scope.since, lte: scope.until }
      : { gte: scope.since };
  }
  return where;
}

function errorOccurrenceScopeSql(
  projectId: string,
  gte: Date,
  lt: Date | undefined,
  app?: string,
  environment?: string,
  lte?: Date,
  platform?: string,
  release?: string
): Prisma.Sql {
  const timeClause =
    lte !== undefined
      ? Prisma.sql`eo."created_at" >= ${gte} AND eo."created_at" <= ${lte}`
      : lt === undefined
        ? Prisma.sql`eo."created_at" >= ${gte}`
        : Prisma.sql`eo."created_at" >= ${gte} AND eo."created_at" < ${lt}`;
  const appClause = app ? Prisma.sql`AND eg."app" = ${app}` : Prisma.empty;
  const envClause = environment
    ? Prisma.sql`AND eg."environment" = ${environment}`
    : Prisma.empty;
  const platformClause = platform
    ? Prisma.sql`AND eo."platform" = ${platform}`
    : Prisma.empty;
  const releaseClause = release ? Prisma.sql`AND ${releaseFilterMatchSql(Prisma.sql`eo."release"`, release)}` : Prisma.empty;
  return Prisma.sql`
    eg."project_id" = ${projectId}
    AND ${timeClause}
    ${appClause}
    ${envClause}
    ${platformClause}
    ${releaseClause}
  `;
}

export function resolveCompareWindow(
  durationMs: number,
  compare: OverviewCompareMode,
  currentSince: Date,
  currentUntil?: Date
): { previousSince: Date; previousUntil: Date | undefined } {
  const ms = durationMs;
  if (compare === "week-ago") {
    const windowEnd = currentUntil ?? new Date(currentSince.getTime() + ms);
    const weekAgoEnd = new Date(windowEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStart = new Date(weekAgoEnd.getTime() - ms);
    return { previousSince: weekAgoStart, previousUntil: weekAgoEnd };
  }
  const previousSince = new Date(currentSince.getTime() - ms);
  return { previousSince, previousUntil: currentSince };
}

/**
 * Upper-bound time clauses for env/release session counts.
 * Includes leading `AND` so callers can splice them after `started_at` / `created_at` lower bounds
 * (omitting `AND` produced Postgres 42601 near `s` / `e`).
 * @internal Exported for unit tests.
 */
export function overviewEnvironmentSessionCountUpperClauses(
  scope: Scope,
  exclusiveUntil?: Date
): { session: Prisma.Sql; event: Prisma.Sql } {
  if (exclusiveUntil !== undefined) {
    return {
      session: Prisma.sql`AND s."started_at" < ${exclusiveUntil}`,
      event: Prisma.sql`AND e."created_at" < ${exclusiveUntil}`,
    };
  }
  if (scope.until !== undefined) {
    return {
      session: Prisma.sql`AND s."started_at" <= ${scope.until}`,
      event: Prisma.sql`AND e."created_at" <= ${scope.until}`,
    };
  }
  return { session: Prisma.empty, event: Prisma.empty };
}

/**
 * Env/release match for Overview session-scoped KPIs (sessions + active users).
 * Release uses the same effective-release rule as Release Health.
 */
function overviewEnvReleaseSessionMatchSql(
  scope: Scope,
  exclusiveUntil?: Date
): Prisma.Sql {
  const { event: eventUpperClause } = overviewEnvironmentSessionCountUpperClauses(
    scope,
    exclusiveUntil
  );
  const eventTime = Prisma.sql`e."created_at" >= ${scope.since} ${eventUpperClause}`;
  const eventExists = (extra: Prisma.Sql) => Prisma.sql`EXISTS (
      SELECT 1 FROM "Event" e
      WHERE e."project_id" = s."project_id"
        AND e."session_id" = s."session_id"
        AND e."app" = s."app"
        AND ${extra}
        AND ${eventTime}
    )`;
  const releaseScope = {
    environment: scope.environment,
    platform: scope.platform,
  };

  if (scope.environment && scope.release) {
    const effectiveRelease = sessionEffectiveReleaseFilterSql(
      scope.projectId,
      "s",
      scope.release,
      releaseScope
    );
    // Match Release Health: Session.environment must equal the filter (no NULL-env fallback).
    return Prisma.sql`(
        s."environment" = ${scope.environment}
        AND ${effectiveRelease}
      )`;
  }
  if (scope.environment) {
    return Prisma.sql`(
        s."environment" = ${scope.environment}
        OR (
          s."environment" IS NULL
          AND ${eventExists(Prisma.sql`e."environment" = ${scope.environment}`)}
        )
      )`;
  }
  return sessionEffectiveReleaseFilterSql(
    scope.projectId,
    "s",
    scope.release!,
    { platform: scope.platform }
  );
}

/**
 * Assembles the env/release session COUNT SQL used by {@link countSessions}.
 * @internal Exported for unit tests (regression: missing AND on upper bounds).
 */
export function overviewEnvironmentSessionCountSql(
  scope: Scope,
  exclusiveUntil?: Date
): Prisma.Sql {
  const appClause = scope.app ? Prisma.sql`AND s."app" = ${scope.app}` : Prisma.empty;
  const platformClause = scope.platform
    ? Prisma.sql`AND s."platform" = ${scope.platform}`
    : Prisma.empty;
  const { session: sessionUpperClause } = overviewEnvironmentSessionCountUpperClauses(
    scope,
    exclusiveUntil
  );
  const envReleaseMatch = overviewEnvReleaseSessionMatchSql(scope, exclusiveUntil);

  return Prisma.sql`
      SELECT COUNT(*)::bigint AS c
      FROM "Session" s
      WHERE s."project_id" = ${scope.projectId}
        AND s."started_at" >= ${scope.since}
        ${sessionUpperClause}
        ${appClause}
        ${platformClause}
        AND ${envReleaseMatch}
    `;
}

/**
 * Distinct session identities for a release-scoped Overview window.
 * Matches Release Health active-user attribution (effective session release).
 * @internal Exported for unit tests.
 */
export function overviewReleaseActiveUsersCountSql(
  scope: Scope,
  exclusiveUntil?: Date
): Prisma.Sql {
  const appClause = scope.app ? Prisma.sql`AND s."app" = ${scope.app}` : Prisma.empty;
  const platformClause = scope.platform
    ? Prisma.sql`AND s."platform" = ${scope.platform}`
    : Prisma.empty;
  const { session: sessionUpperClause } = overviewEnvironmentSessionCountUpperClauses(
    scope,
    exclusiveUntil
  );
  const envReleaseMatch = overviewEnvReleaseSessionMatchSql(scope, exclusiveUntil);
  const identity = sessionUserIdentityExpr("s");

  return Prisma.sql`
      SELECT COUNT(DISTINCT ${identity})::bigint AS c
      FROM "Session" s
      WHERE s."project_id" = ${scope.projectId}
        AND s."started_at" >= ${scope.since}
        ${sessionUpperClause}
        ${appClause}
        ${platformClause}
        AND ${envReleaseMatch}
    `;
}

export async function countSessions(
  prisma: PrismaClient,
  scope: Scope,
  exclusiveUntil?: Date
): Promise<number> {
  // Prefer Session.environment / release; single-event EXISTS when both filters apply.
  if (scope.environment || scope.release) {
    const rows = await prisma.$queryRaw<[{ c: bigint }]>(
      overviewEnvironmentSessionCountSql(scope, exclusiveUntil)
    );
    return Number(rows[0]?.c ?? 0);
  }

  const where = sessionScopeWhere(scope);
  if (exclusiveUntil) {
    (where as { started_at: { gte: Date; lt: Date } }).started_at = {
      gte: scope.since,
      lt: exclusiveUntil,
    };
  }
  return prisma.session.count({ where });
}

export async function countActiveUsers(
  prisma: PrismaClient,
  scope: Scope,
  exclusiveUntil?: Date
): Promise<number> {
  // Align with session KPIs / Release Health when release= is set.
  if (scope.release) {
    const rows = await prisma.$queryRaw<[{ c: bigint }]>(
      overviewReleaseActiveUsersCountSql(scope, exclusiveUntil)
    );
    return Number(rows[0]?.c ?? 0);
  }

  const appClause = scope.app ? Prisma.sql`AND e."app" = ${scope.app}` : Prisma.empty;
  const envClause = scope.environment
    ? Prisma.sql`AND e."environment" = ${scope.environment}`
    : Prisma.empty;
  const platformClause = scope.platform
    ? Prisma.sql`AND e."platform" = ${scope.platform}`
    : Prisma.empty;
  const untilClause =
    exclusiveUntil !== undefined
      ? Prisma.sql`AND e."created_at" < ${exclusiveUntil}`
      : scope.until
        ? Prisma.sql`AND e."created_at" <= ${scope.until}`
        : Prisma.empty;

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
        ${platformClause}
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
  bucket: "hour" | "day" | "week",
  since: Date,
  until?: Date,
  app?: string,
  environment?: string,
  platform?: string,
  release?: string
): Promise<OverviewTimeSeriesPoint[]> {
  const trunc = bucket === "week" ? "week" : bucket;
  const queryUntil = until ?? new Date();
  const querySince = overviewChartQuerySince(since, queryUntil, bucket);
  const appClause = app ? Prisma.sql`AND s."app" = ${app}` : Prisma.empty;
  const platformClause = platform ? Prisma.sql`AND s."platform" = ${platform}` : Prisma.empty;
  const eventUntilClause = until
    ? Prisma.sql`AND e."created_at" <= ${until}`
    : Prisma.empty;
  const eventExists = (extra: Prisma.Sql) => Prisma.sql`EXISTS (
    SELECT 1 FROM "Event" e
    WHERE e."project_id" = s."project_id"
      AND e."session_id" = s."session_id"
      AND e."app" = s."app"
      AND ${extra}
      AND e."created_at" >= ${querySince}
      ${eventUntilClause}
  )`;
  const releaseScope = { environment, platform };

  let envReleaseClause = Prisma.empty;
  if (environment && release) {
    // Match Release Health: Session.environment must equal the filter (no NULL-env fallback).
    envReleaseClause = Prisma.sql`AND (
      s."environment" = ${environment}
      AND ${sessionEffectiveReleaseFilterSql(projectId, "s", release, releaseScope)}
    )`;
  } else if (environment) {
    envReleaseClause = Prisma.sql`AND (
      s."environment" = ${environment}
      OR (
        s."environment" IS NULL
        AND ${eventExists(Prisma.sql`e."environment" = ${environment}`)}
      )
    )`;
  } else if (release) {
    envReleaseClause = Prisma.sql`AND ${sessionEffectiveReleaseFilterSql(
      projectId,
      "s",
      release,
      { platform }
    )}`;
  }

  const rows = await prisma.$queryRaw<{ bucket: Date; avg_sec: number | null }[]>(Prisma.sql`
    SELECT
      (date_trunc(${trunc}, s."started_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      AVG(EXTRACT(EPOCH FROM (s."ended_at" - s."started_at"))) AS avg_sec
    FROM "Session" s
    WHERE s."project_id" = ${projectId}
      AND s."started_at" >= ${querySince}
      ${until ? Prisma.sql`AND s."started_at" <= ${until}` : Prisma.empty}
      AND s."ended_at" IS NOT NULL
      ${appClause}
      ${platformClause}
      ${envReleaseClause}
    GROUP BY 1
    ORDER BY 1
  `);

  return rows.map((r) => ({
    t: r.bucket.toISOString(),
    count: Math.round(Number(r.avg_sec ?? 0)),
  }));
}

export function buildWorkspaceTelemetry(
  eventsCount: number,
  errorsCount: number,
  distinctApps: number,
  distinctSdkVersions: number
): OverviewWorkspaceTelemetry {
  return {
    ingestRequests: eventsCount + errorsCount,
    sdkEventRows: eventsCount,
    distinctApps,
    distinctSdkVersions,
  };
}

export type OverviewEventWindowStats = {
  eventsCount: number;
  eventsPrevious: number;
  distinctEventNames: number;
  distinctApps: number;
  distinctSdkVersions: number;
};

export type OverviewCountPair = {
  current: number;
  previous: number;
};

function eventFilterSql(
  projectId: string,
  app?: string,
  environment?: string,
  platform?: string,
  release?: string
): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`e."project_id" = ${projectId}`];
  if (app) parts.push(Prisma.sql`e."app" = ${app}`);
  if (environment) parts.push(Prisma.sql`e."environment" = ${environment}`);
  if (platform) parts.push(Prisma.sql`e."platform" = ${platform}`);
  if (release) parts.push(releaseFilterMatchSql(Prisma.sql`e."release"`, release));
  return Prisma.join(parts, " AND ");
}

/** One scan of Event for current/previous counts, list total, and workspace breakdown fields. */
export async function getOverviewEventWindowStats(
  prisma: PrismaClient,
  params: {
    projectId: string;
    since: Date;
    until: Date;
    previousSince: Date;
    previousUntil: Date;
    app?: string;
    environment?: string;
    platform?: string;
    release?: string;
  }
): Promise<OverviewEventWindowStats> {
  const {
    projectId,
    since,
    until,
    previousSince,
    previousUntil,
    app,
    environment,
    platform,
    release,
  } = params;
  const filters = eventFilterSql(projectId, app, environment, platform, release);

  const rows = await prisma.$queryRaw<
    [
      {
        events_count: bigint;
        events_previous: bigint;
        distinct_event_names: bigint;
        distinct_apps: bigint;
        distinct_sdk_versions: bigint;
      },
    ]
  >(Prisma.sql`
    SELECT
      COUNT(*) FILTER (
        WHERE e."created_at" >= ${since} AND e."created_at" <= ${until}
      )::bigint AS events_count,
      COUNT(*) FILTER (
        WHERE e."created_at" >= ${previousSince} AND e."created_at" < ${previousUntil}
      )::bigint AS events_previous,
      COUNT(DISTINCT e."name") FILTER (
        WHERE e."created_at" >= ${since} AND e."created_at" <= ${until}
      )::bigint AS distinct_event_names,
      COUNT(DISTINCT e."app") FILTER (
        WHERE e."created_at" >= ${since} AND e."created_at" <= ${until}
      )::bigint AS distinct_apps,
      COUNT(DISTINCT e."sdk_version") FILTER (
        WHERE e."created_at" >= ${since}
          AND e."created_at" <= ${until}
          AND e."sdk_version" IS NOT NULL
      )::bigint AS distinct_sdk_versions
    FROM "Event" e
    WHERE ${filters}
      AND e."created_at" >= ${previousSince}
      AND e."created_at" <= ${until}
  `);

  const row = rows[0];
  return {
    eventsCount: Number(row?.events_count ?? 0),
    eventsPrevious: Number(row?.events_previous ?? 0),
    distinctEventNames: Number(row?.distinct_event_names ?? 0),
    distinctApps: Number(row?.distinct_apps ?? 0),
    distinctSdkVersions: Number(row?.distinct_sdk_versions ?? 0),
  };
}

/** One join scan for current and compare-window error occurrence counts. */
export async function getOverviewErrorCountsPair(
  prisma: PrismaClient,
  params: {
    projectId: string;
    since: Date;
    until: Date;
    previousSince: Date;
    previousUntil: Date;
    app?: string;
    environment?: string;
    platform?: string;
    release?: string;
  }
): Promise<OverviewCountPair> {
  const {
    projectId,
    since,
    until,
    previousSince,
    previousUntil,
    app,
    environment,
    platform,
    release,
  } = params;
  const whereSql = errorOccurrenceScopeSql(
    projectId,
    previousSince,
    undefined,
    app,
    environment,
    until,
    platform,
    release
  );

  const rows = await prisma.$queryRaw<[{ errors_count: bigint; errors_previous: bigint }]>(
    Prisma.sql`
      SELECT
        COUNT(*) FILTER (
          WHERE eo."created_at" >= ${since} AND eo."created_at" <= ${until}
        )::bigint AS errors_count,
        COUNT(*) FILTER (
          WHERE eo."created_at" >= ${previousSince} AND eo."created_at" < ${previousUntil}
        )::bigint AS errors_previous
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eg."id" = eo."error_group_id"
      WHERE ${whereSql}
    `
  );

  const row = rows[0];
  return {
    current: Number(row?.errors_count ?? 0),
    previous: Number(row?.errors_previous ?? 0),
  };
}

/** One Event scan for current and compare-window active user counts. */
export async function getOverviewActiveUsersPair(
  prisma: PrismaClient,
  params: {
    projectId: string;
    since: Date;
    until: Date;
    previousSince: Date;
    previousUntil: Date;
    app?: string;
    environment?: string;
    platform?: string;
    release?: string;
  }
): Promise<OverviewCountPair> {
  const {
    projectId,
    since,
    until,
    previousSince,
    previousUntil,
    app,
    environment,
    platform,
    release,
  } = params;

  // Release scope: distinct session identities with effective-release attribution
  // (same rule as session KPIs / Release Health).
  if (release) {
    const scope: Scope = {
      projectId,
      since,
      until,
      app,
      environment,
      platform,
      release,
    };
    const [current, previous] = await Promise.all([
      countActiveUsers(prisma, scope),
      countActiveUsers(prisma, { ...scope, since: previousSince }, previousUntil),
    ]);
    return { current, previous };
  }

  const filters = eventFilterSql(projectId, app, environment, platform);

  const rows = await prisma.$queryRaw<[{ active_users: bigint; active_users_previous: bigint }]>(
    Prisma.sql`
      SELECT
        COUNT(DISTINCT CASE
          WHEN e."created_at" >= ${since} AND e."created_at" <= ${until}
          THEN COALESCE(e."user_id", e."anonymous_id")
        END)::bigint AS active_users,
        COUNT(DISTINCT CASE
          WHEN e."created_at" >= ${previousSince} AND e."created_at" < ${previousUntil}
          THEN COALESCE(e."user_id", e."anonymous_id")
        END)::bigint AS active_users_previous
      FROM "Event" e
      WHERE ${filters}
        AND e."created_at" >= ${previousSince}
        AND e."created_at" <= ${until}
        AND (e."user_id" IS NOT NULL OR e."anonymous_id" IS NOT NULL)
    `
  );

  const row = rows[0];
  return {
    current: Number(row?.active_users ?? 0),
    previous: Number(row?.active_users_previous ?? 0),
  };
}

/** One Session scan for current and compare-window counts (simple scope only). */
export async function getOverviewSessionsPair(
  prisma: PrismaClient,
  scope: Scope,
  previousSince: Date,
  previousUntil: Date
): Promise<OverviewCountPair> {
  // Env/release need event-EXISTS fallback via countSessions.
  if (scope.environment || scope.release) {
    const [current, previous] = await Promise.all([
      countSessions(prisma, scope),
      countSessions(prisma, { ...scope, since: previousSince }, previousUntil),
    ]);
    return { current, previous };
  }

  const appClause = scope.app ? Prisma.sql`AND s."app" = ${scope.app}` : Prisma.empty;
  const platformClause = scope.platform
    ? Prisma.sql`AND s."platform" = ${scope.platform}`
    : Prisma.empty;
  const until = scope.until ?? new Date();
  const rows = await prisma.$queryRaw<[{ sessions_count: bigint; sessions_previous: bigint }]>(
    Prisma.sql`
      SELECT
        COUNT(*) FILTER (
          WHERE s."started_at" >= ${scope.since} AND s."started_at" <= ${until}
        )::bigint AS sessions_count,
        COUNT(*) FILTER (
          WHERE s."started_at" >= ${previousSince} AND s."started_at" < ${previousUntil}
        )::bigint AS sessions_previous
      FROM "Session" s
      WHERE s."project_id" = ${scope.projectId}
        AND s."started_at" >= ${previousSince}
        AND s."started_at" <= ${until}
        ${appClause}
        ${platformClause}
    `
  );

  const row = rows[0];
  return {
    current: Number(row?.sessions_count ?? 0),
    previous: Number(row?.sessions_previous ?? 0),
  };
}

/** @deprecated Prefer {@link buildWorkspaceTelemetry} with {@link getOverviewEventWindowStats}. */
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
      where: eventWhere,
    }),
    prisma.event.groupBy({
      by: ["sdk_version"],
      where: {
        ...eventWhere,
        sdk_version: { not: null },
      } as Prisma.EventWhereInput,
    }),
  ]);

  return buildWorkspaceTelemetry(
    events,
    errors,
    apps.length,
    sdkVersions.filter((r) => r.sdk_version).length
  );
}

export function computeOverviewHealth(
  events: number,
  errors: number,
  eventsPrevious: number,
  errorsPrevious: number,
  seriesEvents: OverviewTimeSeriesPoint[],
  bucketSeconds = 3600
): OverviewHealth {
  const total = events + errors;
  const totalPrev = eventsPrevious + errorsPrevious;
  const errorRatePct = total > 0 ? (errors / total) * 100 : 0;
  const prevErrorRatePct = totalPrev > 0 ? (errorsPrevious / totalPrev) * 100 : 0;
  const errorRateDeltaPct = errorRatePct - prevErrorRatePct;
  const successRatePct = total > 0 ? (events / total) * 100 : 100;

  const bucketSecondsValue = bucketSeconds;
  const throughputs = seriesEvents.map((p) => p.count / bucketSecondsValue);
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

export type ErrorDetailLinkScope = Pick<
  Scope,
  "app" | "environment" | "platform" | "release"
> & {
  range?: string;
  from?: string;
  to?: string;
  /** Open-ended KPI/list window end — keeps issue detail aligned with Overview. */
  metricsUntil?: string;
  /**
   * When set with metricsUntil, issue detail uses this exact window (Overview KPIs)
   * instead of the Issues-list ~7d metricsUntil-only path.
   */
  metricsSince?: string;
};

export function errorGroupDetailHref(
  id: string,
  scope: ErrorDetailLinkScope
): string {
  const params = new URLSearchParams();
  if (scope.app) params.set("app", scope.app);
  if (scope.environment) params.set("environment", scope.environment);
  if (scope.platform) params.set("platform", scope.platform);
  if (scope.release) params.set("release", scope.release);
  if (scope.range) params.set("range", scope.range);
  if (scope.from) params.set("from", scope.from);
  if (scope.to) params.set("to", scope.to);
  if (scope.metricsSince) params.set("metricsSince", scope.metricsSince);
  if (scope.metricsUntil) params.set("metricsUntil", scope.metricsUntil);
  const q = params.toString();
  return q ? `/dashboard/errors/${id}?${q}` : `/dashboard/errors/${id}`;
}

export async function listActiveIssues(
  prisma: PrismaClient,
  scope: Scope,
  limit = 5,
  linkScope?: ErrorDetailLinkScope
): Promise<OverviewActiveIssue[]> {
  const hrefScope: ErrorDetailLinkScope = linkScope ?? {
    app: scope.app,
    environment: scope.environment,
    platform: scope.platform,
    release: scope.release,
  };
  if (scope.platform || scope.release) {
    const appClause = scope.app ? Prisma.sql`AND eg."app" = ${scope.app}` : Prisma.empty;
    const envClause = scope.environment
      ? Prisma.sql`AND eg."environment" = ${scope.environment}`
      : Prisma.empty;
    const platformClause = scope.platform
      ? Prisma.sql`AND eo."platform" = ${scope.platform}`
      : Prisma.empty;
    const releaseClause = scope.release
      ? Prisma.sql`AND ${releaseFilterMatchSql(Prisma.sql`eo."release"`, scope.release)}`
      : Prisma.empty;
    const untilClause = scope.until
      ? Prisma.sql`AND eo."created_at" <= ${scope.until}`
      : Prisma.empty;
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        message: string;
        app: string;
        environment: string | null;
        occurrences: bigint;
        first_seen: Date;
      }>
    >(Prisma.sql`
      SELECT
        eg.id,
        eg.message,
        eg.app,
        eg.environment,
        COUNT(eo.id)::bigint AS occurrences,
        MIN(eo."created_at") AS first_seen
      FROM "ErrorGroup" eg
      INNER JOIN "ErrorOccurrence" eo ON eo."error_group_id" = eg.id
      WHERE eg."project_id" = ${scope.projectId}
        AND eg."resolved_at" IS NULL
        AND eo."created_at" >= ${scope.since}
        ${untilClause}
        ${appClause}
        ${envClause}
        ${platformClause}
        ${releaseClause}
      GROUP BY eg.id, eg.message, eg.app, eg.environment
      ORDER BY occurrences DESC, first_seen DESC
      LIMIT ${limit}
    `);

    return rows.map((g) => {
      const occurrences = Number(g.occurrences);
      const severity: "P1" | "P3" = occurrences >= 25 ? "P1" : "P3";
      const envPart = g.environment ? ` · ${g.environment}` : "";
      return {
        id: g.id,
        severity,
        title: g.message,
        meta: `${relativeStarted(g.first_seen.toISOString())} · app ${g.app}${envPart} · ${occurrences} occurrences`,
        status: "Open",
        href: errorGroupDetailHref(g.id, hrefScope),
      };
    });
  }

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
      href: errorGroupDetailHref(g.id, hrefScope),
    };
  });
}

export async function countErrorsInWindow(
  prisma: PrismaClient,
  projectId: string,
  gte: Date,
  lt: Date | undefined,
  app?: string,
  environment?: string,
  platform?: string,
  release?: string
): Promise<number> {
  const whereSql = errorOccurrenceScopeSql(
    projectId,
    gte,
    lt,
    app,
    environment,
    undefined,
    platform,
    release
  );
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
