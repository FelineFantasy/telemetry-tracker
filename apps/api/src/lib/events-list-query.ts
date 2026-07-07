/**
 * Event name list: grouping, sorting, aggregates (users/sessions), and SQL helpers.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { buildEventWhereSql } from "./list-query-helpers.js";
import { fetchLatestEventsByName } from "./latest-events-by-name.js";

export const EVENT_LIST_SORTS = [
  "last_seen",
  "first_seen",
  "count",
  "name",
  "users",
  "sessions",
] as const;

export type EventListSort = (typeof EVENT_LIST_SORTS)[number];

export type EventListOrder = "asc" | "desc";

export type EventListFilterInput = {
  appId?: string;
  name?: string;
  environment?: string;
  platform?: string;
  release?: string;
  propertiesContains?: string;
  range: { gte?: Date; lte?: Date };
  /** When list range is all-time, counts use this window (aligned with summary KPIs). */
  eventCountRange?: { gte: Date; lte: Date };
};

export function parseEventListSortParam(
  value: string | undefined
): { ok: true; sort: EventListSort } | { ok: false } {
  if (value === undefined || value.trim() === "") {
    return { ok: true, sort: "last_seen" };
  }
  const legacyMap: Record<string, EventListSort> = {
    created_at: "last_seen",
    app: "last_seen",
    environment: "last_seen",
    platform: "last_seen",
    release: "last_seen",
  };
  const v = legacyMap[value.trim()] ?? value.trim();
  if ((EVENT_LIST_SORTS as readonly string[]).includes(v)) {
    return { ok: true, sort: v as EventListSort };
  }
  return { ok: false };
}

export function parseEventListOrderParam(
  value: string | undefined
): { ok: true; order: EventListOrder } | { ok: false } {
  if (value === undefined || value.trim() === "") {
    return { ok: true, order: "desc" };
  }
  const v = value.trim();
  if (v === "asc" || v === "desc") {
    return { ok: true, order: v };
  }
  return { ok: false };
}

export function isEventAggregateSort(sort: EventListSort): boolean {
  return sort === "users" || sort === "sessions" || sort === "count";
}

export type EventNameListRow = {
  name: string;
  app: string;
  platform: string | null;
  environment: string | null;
  release: string | null;
  count: number;
  count_in_range: number;
  first_seen: Date;
  last_seen: Date;
  users_affected: number;
  sessions_affected: number;
  share_pct: number;
  latest_event_id?: string;
};

function eventIdentityExpr(alias = "e"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`COALESCE(
    NULLIF(TRIM(COALESCE(${a}."user_id", '')), ''),
    NULLIF(TRIM(COALESCE(${a}."anonymous_id", '')), ''),
    NULLIF(TRIM(COALESCE(${a}."session_id", '')), '')
  )`;
}

/** Bounds for in-range counts and drill-down — merges list range with enriched metrics window. */
export function resolveEventCountRangeBounds(
  f: EventListFilterInput
): { gte?: Date; lte?: Date } {
  const gte = f.range.gte ?? f.eventCountRange?.gte;
  const lte = f.range.lte ?? f.eventCountRange?.lte;
  return { gte, lte };
}

function countRangeBounds(f: EventListFilterInput): { gte?: Date; lte?: Date } {
  return resolveEventCountRangeBounds(f);
}

function hasCountRangeBounds(f: EventListFilterInput): boolean {
  const { gte, lte } = countRangeBounds(f);
  return gte != null || lte != null;
}

function countInRangeConditionSql(f: EventListFilterInput, alias = "e"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"."created_at"`);
  const { gte, lte } = countRangeBounds(f);
  const parts: Prisma.Sql[] = [];
  if (gte) parts.push(Prisma.sql`${a} >= ${gte}`);
  if (lte) parts.push(Prisma.sql`${a} <= ${lte}`);
  return Prisma.join(parts, " AND ");
}

function countInRangeExpr(f: EventListFilterInput, alias = "e"): Prisma.Sql {
  if (!hasCountRangeBounds(f)) {
    return Prisma.sql`COUNT(*)::bigint`;
  }
  return Prisma.sql`SUM(CASE WHEN ${countInRangeConditionSql(f, alias)} THEN 1 ELSE 0 END)::bigint`;
}

function countInRangeWhereSql(f: EventListFilterInput, alias = "e"): Prisma.Sql {
  if (!hasCountRangeBounds(f)) {
    return Prisma.empty;
  }
  return Prisma.sql`AND ${countInRangeConditionSql(f, alias)}`;
}

/** PostgreSQL aggregate FILTER for in-range bounds (empty when all-time). */
function inRangeAggregateFilterSql(f: EventListFilterInput, alias = "e"): Prisma.Sql {
  if (!hasCountRangeBounds(f)) {
    return Prisma.empty;
  }
  return Prisma.sql`FILTER (WHERE ${countInRangeConditionSql(f, alias)})`;
}

function latestInRangeFieldExpr(
  f: EventListFilterInput,
  field: "app" | "platform" | "environment" | "release"
): Prisma.Sql {
  const col = Prisma.raw(`e."${field}"`);
  return Prisma.sql`(array_agg(${col} ORDER BY e."created_at" DESC) ${inRangeAggregateFilterSql(f, "e")})[1]`;
}

function sessionsAffectedExpr(f: EventListFilterInput): Prisma.Sql {
  const validSession = Prisma.sql`e."session_id" IS NOT NULL AND TRIM(e."session_id") <> ''`;
  if (!hasCountRangeBounds(f)) {
    return Prisma.sql`COUNT(DISTINCT e."session_id") FILTER (WHERE ${validSession})::bigint`;
  }
  return Prisma.sql`COUNT(DISTINCT e."session_id") FILTER (WHERE ${countInRangeConditionSql(f, "e")} AND ${validSession})::bigint`;
}

function buildGroupedVisibilityHavingSql(f: EventListFilterInput): Prisma.Sql {
  if (!hasCountRangeBounds(f)) {
    return Prisma.empty;
  }
  return Prisma.sql`HAVING ${countInRangeExpr(f, "e")} > 0`;
}

function buildGroupedBaseWhereSql(
  f: EventListFilterInput,
  projectId: string
): Prisma.Sql {
  return buildEventWhereSql({
    projectId,
    appId: f.appId,
    name: f.name,
    environment: f.environment,
    platform: f.platform,
    release: f.release,
    propertiesContains: f.propertiesContains,
  });
}

function orderByGroupedSql(sort: EventListSort, order: EventListOrder): Prisma.Sql {
  const dir = order === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const nulls = order === "asc" ? Prisma.sql`NULLS FIRST` : Prisma.sql`NULLS LAST`;
  switch (sort) {
    case "first_seen":
      return Prisma.sql`ORDER BY g.first_seen ${dir} ${nulls}`;
    case "name":
      return Prisma.sql`ORDER BY g.name ${dir} ${nulls}`;
    case "users":
      return Prisma.sql`ORDER BY g.users_affected ${dir} ${nulls}, g.last_seen DESC`;
    case "sessions":
      return Prisma.sql`ORDER BY g.sessions_affected ${dir} ${nulls}, g.last_seen DESC`;
    case "count":
      return Prisma.sql`ORDER BY g.count_in_range ${dir} ${nulls}, g.last_seen DESC`;
    case "last_seen":
    default:
      return Prisma.sql`ORDER BY g.last_seen ${dir} ${nulls}`;
  }
}

function mapGroupedRow(
  r: Record<string, unknown>,
  totalInRange: number
): EventNameListRow {
  const countInRange = Number(r.count_in_range ?? 0);
  return {
    name: String(r.name),
    app: String(r.app),
    platform: r.platform != null ? String(r.platform) : null,
    environment: r.environment != null ? String(r.environment) : null,
    release: r.release != null ? String(r.release) : null,
    count: Number(r.count ?? 0),
    count_in_range: countInRange,
    first_seen: r.first_seen as Date,
    last_seen: r.last_seen as Date,
    users_affected: Number(r.users_affected ?? 0),
    sessions_affected: Number(r.sessions_affected ?? 0),
    share_pct: totalInRange > 0 ? (countInRange / totalInRange) * 100 : 0,
  };
}

export async function listEventNamesGrouped(
  prisma: PrismaClient,
  f: EventListFilterInput,
  projectId: string,
  sort: EventListSort,
  order: EventListOrder,
  skip: number,
  take: number
): Promise<{ total: number; rows: EventNameListRow[]; totalInRange: number }> {
  const baseWhere = buildGroupedBaseWhereSql(f, projectId);
  const havingSql = buildGroupedVisibilityHavingSql(f);
  const inRangeExpr = countInRangeExpr(f, "e");
  const identity = eventIdentityExpr("e");

  const groupedCte = Prisma.sql`
    WITH grouped AS (
      SELECT
        e."name",
        ${latestInRangeFieldExpr(f, "app")} AS app,
        ${latestInRangeFieldExpr(f, "platform")} AS platform,
        ${latestInRangeFieldExpr(f, "environment")} AS environment,
        ${latestInRangeFieldExpr(f, "release")} AS release,
        COUNT(*)::bigint AS count,
        ${inRangeExpr} AS count_in_range,
        MIN(e."created_at") ${inRangeAggregateFilterSql(f, "e")} AS first_seen,
        MAX(e."created_at") ${inRangeAggregateFilterSql(f, "e")} AS last_seen,
        COUNT(DISTINCT ${identity}) ${inRangeAggregateFilterSql(f, "e")} AS users_affected,
        ${sessionsAffectedExpr(f)} AS sessions_affected
      FROM "Event" e
      WHERE ${baseWhere}
      GROUP BY e."name"
      ${havingSql}
    )
  `;

  const [countRows, totalInRangeRows] = await Promise.all([
    prisma.$queryRaw<[{ c: bigint }]>(
      Prisma.sql`${groupedCte} SELECT COUNT(*)::bigint AS c FROM grouped`
    ),
    prisma.$queryRaw<[{ total: bigint }]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM "Event" e
        WHERE ${baseWhere}
        ${countInRangeWhereSql(f)}
      `
    ),
  ]);

  const total = Number(countRows[0]?.c ?? 0);
  const totalInRange = Number(totalInRangeRows[0]?.total ?? 0);
  const orderSql = orderByGroupedSql(sort, order);

  const dataRows = await prisma.$queryRaw<Record<string, unknown>[]>(
    Prisma.sql`
      ${groupedCte}
      SELECT * FROM grouped g
      ${orderSql}
      LIMIT ${take} OFFSET ${skip}
    `
  );

  const rows = dataRows.map((r) => mapGroupedRow(r, totalInRange));
  return { total, rows, totalInRange };
}

/** Attach latest event ids for row drill-down links. */
export async function attachLatestEventIds(
  prisma: PrismaClient,
  rows: EventNameListRow[],
  f: EventListFilterInput,
  projectId: string
): Promise<EventNameListRow[]> {
  if (rows.length === 0) return rows;
  const { gte, lte } = resolveEventCountRangeBounds(f);
  const latest = await fetchLatestEventsByName(prisma, {
    projectId,
    since: gte,
    until: lte,
    app: f.appId,
    environment: f.environment,
    platform: f.platform,
    release: f.release,
    propertiesContains: f.propertiesContains,
    names: rows.map((r) => r.name),
  });

  return rows.map((row) => ({
    ...row,
    latest_event_id: latest.get(row.name)?.id,
  }));
}

export function serializeEventNameListItem(
  row: EventNameListRow & { latest_event_id?: string }
): Record<string, unknown> {
  return {
    name: row.name,
    app: row.app,
    platform: row.platform,
    environment: row.environment,
    release: row.release,
    count: row.count,
    count_in_range: row.count_in_range,
    first_seen: row.first_seen.toISOString(),
    last_seen: row.last_seen.toISOString(),
    users_affected: row.users_affected,
    sessions_affected: row.sessions_affected,
    share_pct: row.share_pct,
    latest_event_id: row.latest_event_id ?? null,
  };
}
