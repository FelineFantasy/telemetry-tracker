/**
 * Releases Health page (#453): per-release adoption and regression KPIs.
 *
 * - KPI window drives session / event / error counts and adoption.
 * - First/last seen are historical (project + env + platform + app), independent of the KPI window.
 * - Previous release = next-earlier historical first-seen among known releases (Unknown excluded).
 * - Ordering never uses semver — release ids may be hashes, build numbers, or arbitrary strings.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { sessionUserIdentityExpr } from "./brief-snapshot-sql.js";
import { resolveCompareWindow } from "./overview-stats.js";
import {
  isUnknownReleaseKey,
  normalizeReleaseKeySql,
  UNKNOWN_RELEASE_KEY,
} from "./release-key.js";

export const RELEASES_SORTS = ["recency", "adoption", "errors", "error_rate"] as const;
export type ReleasesSort = (typeof RELEASES_SORTS)[number];
export type ReleasesOrder = "asc" | "desc";

export type ReleasesFilterInput = {
  appId?: string;
  platform?: string;
  environment?: string;
  range: { gte?: Date; lte?: Date };
};

export type ResolvedReleasesWindow = {
  since: Date;
  until: Date;
  previousSince: Date;
  previousUntil: Date;
  label: string;
  compareLabel: string;
};

export type ReleaseVsPrevious = {
  errorRatePp: number | null;
  sessionsPct: number | null;
  errorsPct: number | null;
};

export type ReleaseHealthRow = {
  release: string | null;
  releaseKey: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sessions: number;
  activeUsers: number;
  events: number;
  errors: number;
  errorRatePct: number | null;
  adoptionSharePct: number;
  previousReleaseKey: string | null;
  vsPrevious: ReleaseVsPrevious | null;
};

export type ReleasesPageSummary = {
  window: {
    since: string;
    until: string;
    label: string;
    compareLabel: string;
  };
  scope: {
    app?: string;
    environment?: string;
    platform?: string;
  };
  totals: {
    sessions: number;
    events: number;
    errors: number;
  };
  items: ReleaseHealthRow[];
  sort: ReleasesSort;
  order: ReleasesOrder;
};

const DEFAULT_SUMMARY_MS = 7 * 24 * 60 * 60 * 1000;

export function parseReleasesMetricsAnchor(value: string | undefined): Date {
  const raw = value?.trim();
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function resolveReleasesSummaryWindow(
  range: { gte?: Date; lte?: Date },
  anchor: Date = new Date()
): ResolvedReleasesWindow {
  const until = range.lte ?? anchor;
  const since = range.gte ?? new Date(until.getTime() - DEFAULT_SUMMARY_MS);
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
    compareLabel: "vs previous release",
  };
}

export function buildReleasesFilter(input: {
  appId?: string;
  platform?: string;
  environment?: string;
  range: { gte?: Date; lte?: Date };
}): ReleasesFilterInput {
  const filter: ReleasesFilterInput = { range: input.range };
  if (input.appId) filter.appId = input.appId;
  if (input.platform) filter.platform = input.platform;
  if (input.environment) filter.environment = input.environment;
  return filter;
}

export function parseReleasesSortParam(
  value: string | undefined
): { ok: true; sort: ReleasesSort } | { ok: false } {
  if (value === undefined || value.trim() === "") {
    return { ok: true, sort: "recency" };
  }
  const v = value.trim() as ReleasesSort;
  if ((RELEASES_SORTS as readonly string[]).includes(v)) {
    return { ok: true, sort: v };
  }
  return { ok: false };
}

export function parseReleasesOrderParam(
  value: string | undefined
): { ok: true; order: ReleasesOrder } | { ok: false } {
  if (value === undefined || value.trim() === "") {
    return { ok: true, order: "desc" };
  }
  const v = value.trim();
  if (v === "asc" || v === "desc") return { ok: true, order: v };
  return { ok: false };
}

/** Error occurrences / sessions × 100; null when sessions are zero. */
export function releaseErrorRatePct(errors: number, sessions: number): number | null {
  if (sessions <= 0) return null;
  return Math.round((errors / sessions) * 10000) / 100;
}

export function releaseAdoptionSharePct(sessions: number, totalSessions: number): number {
  if (totalSessions <= 0) return 0;
  return Math.round((sessions / totalSessions) * 10000) / 100;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 10000) / 100;
}

export function errorRatePpDelta(
  current: number | null,
  previous: number | null
): number | null {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 100) / 100;
}

type AggRow = {
  release_key: string | null;
  first_seen: Date;
  last_seen: Date;
  sessions: bigint;
  active_users: bigint;
  events: bigint;
  errors: bigint;
};

function eventScopeSql(alias: string, f: ReleasesFilterInput, projectId: string): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  const parts: Prisma.Sql[] = [Prisma.sql`${a}."project_id" = ${projectId}`];
  if (f.appId) parts.push(Prisma.sql`${a}."app" = ${f.appId}`);
  if (f.environment) parts.push(Prisma.sql`${a}."environment" = ${f.environment}`);
  if (f.platform) parts.push(Prisma.sql`${a}."platform" = ${f.platform}`);
  return Prisma.join(parts, " AND ");
}

function sessionScopeSql(alias: string, f: ReleasesFilterInput, projectId: string): Prisma.Sql {
  return eventScopeSql(alias, f, projectId);
}

/**
 * Prefer Session.release; when blank, fall back to the latest non-blank Event.release
 * for the same session (aligned with Sessions list legacy inference).
 */
function sessionEffectiveReleaseKeySql(
  sessionAlias: string,
  f: ReleasesFilterInput,
  projectId: string
): Prisma.Sql {
  const s = Prisma.raw(`"${sessionAlias}"`);
  const eventParts: Prisma.Sql[] = [
    Prisma.sql`e."project_id" = ${projectId}`,
    Prisma.sql`e."session_id" = ${s}."session_id"`,
    Prisma.sql`e."app" = ${s}."app"`,
    Prisma.sql`e."release" IS NOT NULL`,
    Prisma.sql`TRIM(e."release") <> ''`,
  ];
  if (f.environment) {
    eventParts.push(Prisma.sql`e."environment" = ${f.environment}`);
  }
  if (f.platform) {
    eventParts.push(Prisma.sql`e."platform" = ${f.platform}`);
  }
  return Prisma.sql`COALESCE(
    ${normalizeReleaseKeySql(Prisma.sql`${s}."release"`)},
    (
      SELECT TRIM(e."release")
      FROM "Event" e
      WHERE ${Prisma.join(eventParts, " AND ")}
      ORDER BY e."created_at" DESC
      LIMIT 1
    )
  )`;
}

function errorOccurrenceScopeSql(
  eoAlias: string,
  egAlias: string,
  f: ReleasesFilterInput,
  projectId: string
): Prisma.Sql {
  const eo = Prisma.raw(`"${eoAlias}"`);
  const eg = Prisma.raw(`"${egAlias}"`);
  const parts: Prisma.Sql[] = [Prisma.sql`${eg}."project_id" = ${projectId}`];
  if (f.appId) parts.push(Prisma.sql`${eg}."app" = ${f.appId}`);
  if (f.environment) parts.push(Prisma.sql`${eg}."environment" = ${f.environment}`);
  if (f.platform) parts.push(Prisma.sql`${eo}."platform" = ${f.platform}`);
  return Prisma.join(parts, " AND ");
}

export function sortReleaseHealthRows(
  rows: ReleaseHealthRow[],
  sort: ReleasesSort,
  order: ReleasesOrder
): ReleaseHealthRow[] {
  const dir = order === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case "adoption":
        cmp = a.adoptionSharePct - b.adoptionSharePct;
        break;
      case "errors":
        cmp = a.errors - b.errors;
        break;
      case "error_rate": {
        const ar = a.errorRatePct;
        const br = b.errorRatePct;
        if (ar == null && br == null) cmp = 0;
        else if (ar == null) return 1; // always last
        else if (br == null) return -1;
        else cmp = ar - br;
        break;
      }
      case "recency":
      default:
        cmp = new Date(a.firstSeenAt).getTime() - new Date(b.firstSeenAt).getTime();
        break;
    }
    if (cmp !== 0) return cmp * dir;
    // Stable tie-break: known releases before Unknown, then key.
    const aUnknown = isUnknownReleaseKey(a.releaseKey) ? 1 : 0;
    const bUnknown = isUnknownReleaseKey(b.releaseKey) ? 1 : 0;
    if (aUnknown !== bUnknown) return aUnknown - bUnknown;
    return a.releaseKey.localeCompare(b.releaseKey) * dir;
  });
  return sorted;
}

/** Attach previous-release pointers and vs-previous deltas (Unknown excluded from chain). */
export function attachPreviousReleaseComparisons(rows: ReleaseHealthRow[]): ReleaseHealthRow[] {
  const byFirstSeen = [...rows]
    .filter((r) => !isUnknownReleaseKey(r.releaseKey))
    .sort(
      (a, b) =>
        new Date(a.firstSeenAt).getTime() - new Date(b.firstSeenAt).getTime() ||
        a.releaseKey.localeCompare(b.releaseKey)
    );

  const previousKeyByRelease = new Map<string, string | null>();
  for (let i = 0; i < byFirstSeen.length; i++) {
    const prev = i > 0 ? byFirstSeen[i - 1]! : null;
    previousKeyByRelease.set(byFirstSeen[i]!.releaseKey, prev?.releaseKey ?? null);
  }

  const byKey = new Map(rows.map((r) => [r.releaseKey, r]));

  return rows.map((row) => {
    if (isUnknownReleaseKey(row.releaseKey)) {
      return { ...row, previousReleaseKey: null, vsPrevious: null };
    }
    const prevKey = previousKeyByRelease.get(row.releaseKey) ?? null;
    if (!prevKey) {
      return { ...row, previousReleaseKey: null, vsPrevious: null };
    }
    const prev = byKey.get(prevKey);
    if (!prev) {
      return { ...row, previousReleaseKey: prevKey, vsPrevious: null };
    }
    return {
      ...row,
      previousReleaseKey: prevKey,
      vsPrevious: {
        errorRatePp: errorRatePpDelta(row.errorRatePct, prev.errorRatePct),
        sessionsPct: percentChange(row.sessions, prev.sessions),
        errorsPct: percentChange(row.errors, prev.errors),
      },
    };
  });
}

export async function fetchReleasesPageSummary(
  prisma: PrismaClient,
  filter: ReleasesFilterInput,
  projectId: string,
  window: ResolvedReleasesWindow,
  sort: ReleasesSort = "recency",
  order: ReleasesOrder = "desc"
): Promise<ReleasesPageSummary> {
  const eventScope = eventScopeSql("e", filter, projectId);
  const sessionScope = sessionScopeSql("s", filter, projectId);
  const errorScope = errorOccurrenceScopeSql("eo", "eg", filter, projectId);
  const eventReleaseKey = normalizeReleaseKeySql(Prisma.sql`e."release"`);
  const sessionReleaseKey = sessionEffectiveReleaseKeySql("s", filter, projectId);
  const errorReleaseKey = normalizeReleaseKeySql(Prisma.sql`eo."release"`);
  const identity = sessionUserIdentityExpr("s");

  const rows = await prisma.$queryRaw<AggRow[]>(Prisma.sql`
    WITH event_hist AS (
      SELECT
        ${eventReleaseKey} AS release_key,
        MIN(e."created_at") AS first_seen,
        MAX(e."created_at") AS last_seen
      FROM "Event" e
      WHERE ${eventScope}
      GROUP BY 1
    ),
    error_hist AS (
      SELECT
        ${errorReleaseKey} AS release_key,
        MIN(eo."created_at") AS first_seen,
        MAX(eo."created_at") AS last_seen
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eg."id" = eo."error_group_id"
      WHERE ${errorScope}
      GROUP BY 1
    ),
    session_hist AS (
      SELECT
        ${sessionReleaseKey} AS release_key,
        MIN(s."started_at") AS first_seen,
        MAX(s."started_at") AS last_seen
      FROM "Session" s
      WHERE ${sessionScope}
      GROUP BY 1
    ),
    historical AS (
      SELECT
        release_key,
        MIN(first_seen) AS first_seen,
        MAX(last_seen) AS last_seen
      FROM (
        SELECT release_key, first_seen, last_seen FROM event_hist
        UNION ALL
        SELECT release_key, first_seen, last_seen FROM error_hist
        UNION ALL
        SELECT release_key, first_seen, last_seen FROM session_hist
      ) h
      GROUP BY release_key
    ),
    event_kpis AS (
      SELECT
        ${eventReleaseKey} AS release_key,
        COUNT(*)::bigint AS events
      FROM "Event" e
      WHERE ${eventScope}
        AND e."created_at" >= ${window.since}
        AND e."created_at" <= ${window.until}
      GROUP BY 1
    ),
    error_kpis AS (
      SELECT
        ${errorReleaseKey} AS release_key,
        COUNT(*)::bigint AS errors
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eg."id" = eo."error_group_id"
      WHERE ${errorScope}
        AND eo."created_at" >= ${window.since}
        AND eo."created_at" <= ${window.until}
      GROUP BY 1
    ),
    session_kpis AS (
      SELECT
        ${sessionReleaseKey} AS release_key,
        COUNT(*)::bigint AS sessions,
        COUNT(DISTINCT ${identity})::bigint AS active_users
      FROM "Session" s
      WHERE ${sessionScope}
        AND s."started_at" >= ${window.since}
        AND s."started_at" <= ${window.until}
      GROUP BY 1
    ),
    keys AS (
      SELECT release_key FROM historical
      UNION
      SELECT release_key FROM event_kpis
      UNION
      SELECT release_key FROM error_kpis
      UNION
      SELECT release_key FROM session_kpis
    )
    SELECT
      k.release_key,
      COALESCE(h.first_seen, ${window.since}) AS first_seen,
      COALESCE(h.last_seen, ${window.until}) AS last_seen,
      COALESCE(sk.sessions, 0)::bigint AS sessions,
      COALESCE(sk.active_users, 0)::bigint AS active_users,
      COALESCE(ev.events, 0)::bigint AS events,
      COALESCE(er.errors, 0)::bigint AS errors
    FROM keys k
    LEFT JOIN historical h ON h.release_key IS NOT DISTINCT FROM k.release_key
    LEFT JOIN event_kpis ev ON ev.release_key IS NOT DISTINCT FROM k.release_key
    LEFT JOIN error_kpis er ON er.release_key IS NOT DISTINCT FROM k.release_key
    LEFT JOIN session_kpis sk ON sk.release_key IS NOT DISTINCT FROM k.release_key
  `);

  const totalSessions = rows.reduce((sum, r) => sum + Number(r.sessions), 0);
  const totalEvents = rows.reduce((sum, r) => sum + Number(r.events), 0);
  const totalErrors = rows.reduce((sum, r) => sum + Number(r.errors), 0);

  const baseRows: ReleaseHealthRow[] = rows.map((r) => {
    const releaseKey = r.release_key == null ? UNKNOWN_RELEASE_KEY : r.release_key;
    const sessions = Number(r.sessions);
    const errors = Number(r.errors);
    const events = Number(r.events);
    return {
      release: isUnknownReleaseKey(releaseKey) ? null : releaseKey,
      releaseKey,
      firstSeenAt: r.first_seen.toISOString(),
      lastSeenAt: r.last_seen.toISOString(),
      sessions,
      activeUsers: Number(r.active_users),
      events,
      errors,
      errorRatePct: releaseErrorRatePct(errors, sessions),
      adoptionSharePct: releaseAdoptionSharePct(sessions, totalSessions),
      previousReleaseKey: null,
      vsPrevious: null,
    };
  });

  const withCompare = attachPreviousReleaseComparisons(baseRows);
  const items = sortReleaseHealthRows(withCompare, sort, order);

  return {
    window: {
      since: window.since.toISOString(),
      until: window.until.toISOString(),
      label: window.label,
      compareLabel: window.compareLabel,
    },
    scope: {
      ...(filter.appId ? { app: filter.appId } : {}),
      ...(filter.environment ? { environment: filter.environment } : {}),
      ...(filter.platform ? { platform: filter.platform } : {}),
    },
    totals: {
      sessions: totalSessions,
      events: totalEvents,
      errors: totalErrors,
    },
    items,
    sort,
    order,
  };
}
