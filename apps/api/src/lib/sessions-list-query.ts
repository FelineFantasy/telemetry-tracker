/**
 * Sessions list: enriched rows (duration, pages/events, status) and SQL sorting.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import {
  type SessionListFilterInput,
  fetchIdentityFirstSeenAt,
  resolveSessionIdentity,
  sessionFilterSql,
  sessionHasNoProjectErrorsSql,
} from "./sessions-page-summary.js";

/** Event names counted as page/screen views in session aggregates. */
export const SESSION_PAGE_EVENT_NAMES = ["$screen", "page_view", "screen_view"] as const;

export const SESSION_LIST_SORTS = [
  "duration",
  "events",
  "pages",
  "started_at",
  "ended_at",
  "session_id",
  "app",
  "platform",
  "user_id",
  "status",
] as const;

export type SessionListSort = (typeof SESSION_LIST_SORTS)[number];

export type SessionListOrder = "asc" | "desc";

export type SessionListStatus = "healthy" | "warning";

export type SessionListRow = {
  id: string;
  session_id: string;
  app: string;
  platform: string | null;
  environment: string | null;
  release: string | null;
  user_id: string | null;
  anonymous_id: string | null;
  user_email: string | null;
  country: string | null;
  device_browser: string | null;
  device_os: string | null;
  sdk_version: string | null;
  started_at: Date;
  ended_at: Date | null;
  duration_sec: number;
  event_count: number;
  page_count: number;
  status: SessionListStatus;
  identity_first_seen_at?: Date | null;
};

export function parseSessionListSortParam(
  value: string | undefined
): { ok: true; sort: SessionListSort } | { ok: false } {
  if (value === undefined || value.trim() === "") {
    return { ok: true, sort: "duration" };
  }
  const v = value.trim();
  if ((SESSION_LIST_SORTS as readonly string[]).includes(v)) {
    return { ok: true, sort: v as SessionListSort };
  }
  return { ok: false };
}

export function parseSessionListOrderParam(
  value: string | undefined
): { ok: true; order: SessionListOrder } | { ok: false } {
  if (value === undefined || value.trim() === "") {
    return { ok: true, order: "desc" };
  }
  const v = value.trim();
  if (v === "asc" || v === "desc") {
    return { ok: true, order: v };
  }
  return { ok: false };
}

export function isSessionAggregateSort(sort: SessionListSort): boolean {
  return sort === "duration" || sort === "events" || sort === "pages" || sort === "status";
}

export function resolveSessionStatus(hasErrors: boolean): SessionListStatus {
  return hasErrors ? "warning" : "healthy";
}

function sessionEventStatsLateralSql(): Prisma.Sql {
  const pageNames = SESSION_PAGE_EVENT_NAMES.map((n) => Prisma.sql`${n}`);
  return Prisma.sql`
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS event_count,
        MAX(e."created_at") AS last_event_at,
        COUNT(DISTINCT CASE
          WHEN e."name" IN (${Prisma.join(pageNames)})
            THEN COALESCE(
              NULLIF(TRIM(e."properties"->>'name'), ''),
              NULLIF(TRIM(e."properties"->>'url'), ''),
              NULLIF(TRIM(e."properties"->>'path'), ''),
              e."id"::text
            )
        END)::int AS page_count
      FROM "Event" e
      WHERE e."project_id" = s."project_id"
        AND e."session_id" = s."session_id"
        AND e."app" = s."app"
    ) ev ON TRUE
  `;
}

function durationSecExpr(): Prisma.Sql {
  return Prisma.sql`COALESCE(
    CASE
      WHEN s."ended_at" IS NOT NULL
        THEN EXTRACT(EPOCH FROM (s."ended_at" - s."started_at"))
    END,
    CASE
      WHEN ev.last_event_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (ev.last_event_at - s."started_at"))
    END,
    0
  )`;
}

function statusExpr(projectId: string): Prisma.Sql {
  const healthy = sessionHasNoProjectErrorsSql(projectId, "s");
  return Prisma.sql`CASE WHEN ${healthy} THEN 'healthy' ELSE 'warning' END`;
}

function sessionStartedBoundsSql(gte: Date, lte: Date): Prisma.Sql {
  return Prisma.sql`s."started_at" >= ${gte} AND s."started_at" <= ${lte}`;
}

function orderByEnrichedSql(sort: SessionListSort, order: SessionListOrder): Prisma.Sql {
  const dir = order === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const nulls = order === "asc" ? Prisma.sql`NULLS FIRST` : Prisma.sql`NULLS LAST`;
  switch (sort) {
    case "events":
      return Prisma.sql`ORDER BY e.event_count ${dir} ${nulls}, e.started_at DESC`;
    case "pages":
      return Prisma.sql`ORDER BY e.page_count ${dir} ${nulls}, e.started_at DESC`;
    case "status":
      return Prisma.sql`ORDER BY e.status ${dir} ${nulls}, e.started_at DESC`;
    case "ended_at":
      return Prisma.sql`ORDER BY e.ended_at ${dir} ${nulls}, e.started_at DESC`;
    case "session_id":
      return Prisma.sql`ORDER BY e.session_id ${dir} ${nulls}, e.started_at DESC`;
    case "app":
      return Prisma.sql`ORDER BY e.app ${dir} ${nulls}, e.started_at DESC`;
    case "platform":
      return Prisma.sql`ORDER BY e.platform ${dir} ${nulls}, e.started_at DESC`;
    case "user_id":
      return Prisma.sql`ORDER BY e.user_id ${dir} ${nulls}, e.started_at DESC`;
    case "started_at":
      return Prisma.sql`ORDER BY e.started_at ${dir} ${nulls}`;
    case "duration":
    default:
      return Prisma.sql`ORDER BY e.duration_sec ${dir} ${nulls}, e.started_at DESC`;
  }
}

function mapEnrichedRow(r: Record<string, unknown>): SessionListRow {
  return {
    id: String(r.id),
    session_id: String(r.session_id),
    app: String(r.app),
    platform: r.platform != null ? String(r.platform) : null,
    environment: r.environment != null ? String(r.environment) : null,
    release: r.release != null ? String(r.release) : null,
    user_id: r.user_id != null ? String(r.user_id) : null,
    anonymous_id: r.anonymous_id != null ? String(r.anonymous_id) : null,
    user_email: r.user_email != null ? String(r.user_email) : null,
    country: r.country != null ? String(r.country) : null,
    device_browser: r.device_browser != null ? String(r.device_browser) : null,
    device_os: r.device_os != null ? String(r.device_os) : null,
    sdk_version: r.sdk_version != null ? String(r.sdk_version) : null,
    started_at: r.started_at as Date,
    ended_at: (r.ended_at as Date | null) ?? null,
    duration_sec: Math.round(Number(r.duration_sec ?? 0)),
    event_count: Number(r.event_count ?? 0),
    page_count: Number(r.page_count ?? 0),
    status: String(r.status) === "warning" ? "warning" : "healthy",
  };
}

function enrichedSelectSql(projectId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT
      s."id",
      s."session_id",
      s."app",
      s."platform",
      s."environment",
      s."release",
      s."user_id",
      s."anonymous_id",
      s."user_email",
      s."country",
      s."device_browser",
      s."device_os",
      s."sdk_version",
      s."started_at",
      s."ended_at",
      ${durationSecExpr()} AS duration_sec,
      COALESCE(ev.event_count, 0)::int AS event_count,
      COALESCE(ev.page_count, 0)::int AS page_count,
      ${statusExpr(projectId)} AS status
    FROM "Session" s
    ${sessionEventStatsLateralSql()}
  `;
}

export async function listSessionsEnriched(
  prisma: PrismaClient,
  f: SessionListFilterInput,
  projectId: string,
  startedAt: { gte: Date; lte: Date },
  sort: SessionListSort,
  order: SessionListOrder,
  skip: number,
  take: number
): Promise<{ total: number; rows: SessionListRow[]; maxDurationSec: number }> {
  const filters = sessionFilterSql(projectId, f, startedAt);
  const bounds = sessionStartedBoundsSql(startedAt.gte, startedAt.lte);
  const orderSql = orderByEnrichedSql(sort, order);

  const [countRows, maxDurationRows, dataRows] = await Promise.all([
    prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS c
      FROM "Session" s
      WHERE ${filters}
        AND ${bounds}
    `),
    prisma.$queryRaw<[{ max_duration_sec: number | null }]>(Prisma.sql`
      WITH enriched AS (
        ${enrichedSelectSql(projectId)}
        WHERE ${filters}
          AND ${bounds}
      )
      SELECT MAX(e.duration_sec) AS max_duration_sec FROM enriched e
    `),
    prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
      WITH enriched AS (
        ${enrichedSelectSql(projectId)}
        WHERE ${filters}
          AND ${bounds}
      )
      SELECT * FROM enriched e
      ${orderSql}
      LIMIT ${take} OFFSET ${skip}
    `),
  ]);

  const total = Number(countRows[0]?.c ?? 0);
  const rows = dataRows.map(mapEnrichedRow);
  const maxDurationSec = Math.round(Number(maxDurationRows[0]?.max_duration_sec ?? 0));
  return { total, rows, maxDurationSec };
}

export async function fetchSessionEnrichedById(
  prisma: PrismaClient,
  projectId: string,
  sessionDbId: string
): Promise<SessionListRow | null> {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
    ${enrichedSelectSql(projectId)}
    WHERE s."project_id" = ${projectId}
      AND s."id" = ${sessionDbId}
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  const enriched = mapEnrichedRow(row);
  if (!resolveSessionIdentity(enriched.user_id, enriched.anonymous_id)) return enriched;
  const identityFirstSeenAt = await fetchIdentityFirstSeenAt(
    prisma,
    projectId,
    enriched.user_id,
    enriched.anonymous_id
  );
  return { ...enriched, identity_first_seen_at: identityFirstSeenAt };
}

export function serializeSessionListItem(
  row: SessionListRow,
  maxDurationSec?: number
): Record<string, unknown> {
  return {
    id: row.id,
    session_id: row.session_id,
    app: row.app,
    platform: row.platform,
    environment: row.environment,
    release: row.release,
    user_id: row.user_id,
    anonymous_id: row.anonymous_id,
    user_email: row.user_email,
    country: row.country,
    device_browser: row.device_browser,
    device_os: row.device_os,
    sdk_version: row.sdk_version,
    started_at: row.started_at.toISOString(),
    ended_at: row.ended_at?.toISOString() ?? null,
    duration_sec: row.duration_sec,
    event_count: row.event_count,
    page_count: row.page_count,
    status: row.status,
    max_duration_sec: maxDurationSec ?? null,
    identity_first_seen_at: row.identity_first_seen_at?.toISOString() ?? null,
  };
}
