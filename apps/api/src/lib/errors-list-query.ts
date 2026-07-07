/**
 * Error group list: sorting, aggregates (users/sessions/trend), and SQL helpers.
 *
 * Trend score for sorting: `occurrences_recent / max(occurrences_previous, 1)` — higher means
 * more activity in the recent window vs the previous window of equal length.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { escapeLikePattern } from "./list-query.js";
import { parseTimeRangeQuery } from "./time-range.js";

export const ERROR_LIST_SORTS = [
  "last_seen",
  "first_seen",
  "occurrences",
  "message",
  "app",
  "environment",
  "users",
  "sessions",
  "trend",
] as const;

export type ErrorListSort = (typeof ERROR_LIST_SORTS)[number];

export type ErrorListOrder = "asc" | "desc";

export type TrendWindow = string;

export type ParsedTrendWindow = {
  durationMs: number;
  end: Date;
  label: string;
  key: string;
};

export type ErrorListFilterInput = {
  appId?: string;
  environment?: string;
  release?: string;
  q?: string;
  range: { gte?: Date; lte?: Date };
  /** When list range is all-time, counts use this window (aligned with summary KPIs). */
  occurrenceCountRange?: { gte: Date; lte: Date };
  status: "all" | "unresolved" | "resolved";
};

/** Omitted → default; invalid when present → validation fails (400). */
export function parseErrorListSortParam(
  value: string | undefined
): { ok: true; sort: ErrorListSort } | { ok: false } {
  if (value === undefined || value.trim() === "") {
    return { ok: true, sort: "last_seen" };
  }
  const v = value.trim();
  if ((ERROR_LIST_SORTS as readonly string[]).includes(v)) {
    return { ok: true, sort: v as ErrorListSort };
  }
  return { ok: false };
}

export function parseErrorListOrderParam(
  value: string | undefined
): { ok: true; order: ErrorListOrder } | { ok: false } {
  if (value === undefined || value.trim() === "") {
    return { ok: true, order: "desc" };
  }
  const v = value.trim();
  if (v === "asc" || v === "desc") {
    return { ok: true, order: v };
  }
  return { ok: false };
}

export function parseTrendWindowParam(
  query: {
    trendWindow?: string;
    trendFrom?: string;
    trendTo?: string;
  },
  anchorEnd: Date = new Date(),
  defaultKey = "24h"
): { ok: true; trend: ParsedTrendWindow } | { ok: false; error: string } {
  const parsed = parseTimeRangeQuery(
    {
      range: query.trendWindow,
      from: query.trendFrom,
      to: query.trendTo,
    },
    anchorEnd,
    defaultKey
  );
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  if (parsed.range.key === "all" || parsed.range.key === "none") {
    return { ok: false, error: "Trend window cannot be all time" };
  }
  return {
    ok: true,
    trend: {
      durationMs: parsed.range.durationMs,
      end: parsed.range.lte,
      label: parsed.range.label,
      key: parsed.range.key,
    },
  };
}

export function buildErrorGroupWhereInput(
  f: ErrorListFilterInput,
  projectId: string
): Prisma.ErrorGroupWhereInput {
  const where: Prisma.ErrorGroupWhereInput = { project_id: projectId };
  if (f.appId) where.app = f.appId;
  if (f.environment) where.environment = f.environment;
  if (f.q) where.message = { contains: f.q, mode: "insensitive" };
  if (f.range.gte || f.range.lte) {
    where.last_seen = {};
    if (f.range.gte) where.last_seen.gte = f.range.gte;
    if (f.range.lte) where.last_seen.lte = f.range.lte;
  }
  if (f.status === "unresolved") where.resolved_at = null;
  if (f.status === "resolved") where.resolved_at = { not: null };
  if (f.release) {
    where.occurrences_list = {
      some: { release: f.release },
    };
  }
  return where;
}

export type ScalarErrorListSort = Exclude<
  ErrorListSort,
  "users" | "sessions" | "trend" | "occurrences"
>;

function prismaOrderBy(
  sort: ScalarErrorListSort,
  order: ErrorListOrder
): Prisma.ErrorGroupOrderByWithRelationInput {
  const o = order;
  switch (sort) {
    case "first_seen":
      return { first_seen: o };
    case "occurrences":
      return { occurrences: o };
    case "message":
      return { message: o };
    case "app":
      return { app: o };
    case "environment":
      return { environment: o };
    case "last_seen":
    default:
      return { last_seen: o };
  }
}

/** Scalar sorts only — users/sessions/trend/occurrences use raw SQL aggregates. */
export function isAggregateSort(sort: ErrorListSort): boolean {
  return (
    sort === "users" ||
    sort === "sessions" ||
    sort === "trend" ||
    sort === "occurrences"
  );
}

export type ErrorGroupListRow = {
  id: string;
  fingerprint: string;
  message: string;
  top_stack: string | null;
  app: string;
  environment: string | null;
  occurrences: number;
  occurrences_in_range?: number;
  first_seen: Date;
  last_seen: Date;
  resolved_at: Date | null;
  users_affected?: number;
  sessions_affected?: number;
  occurrences_recent?: number;
  occurrences_previous?: number;
  trend_ratio?: number;
};

function mapRawRow(r: Record<string, unknown>): ErrorGroupListRow {
  return {
    id: String(r.id),
    fingerprint: String(r.fingerprint),
    message: String(r.message),
    top_stack: r.top_stack != null ? String(r.top_stack) : null,
    app: String(r.app),
    environment: r.environment != null ? String(r.environment) : null,
    occurrences: Number(r.occurrences),
    occurrences_in_range:
      r.occurrences_in_range != null ? Number(r.occurrences_in_range) : undefined,
    first_seen: r.first_seen as Date,
    last_seen: r.last_seen as Date,
    resolved_at: r.resolved_at != null ? (r.resolved_at as Date) : null,
    users_affected: r.users_affected != null ? Number(r.users_affected) : undefined,
    sessions_affected: r.sessions_affected != null ? Number(r.sessions_affected) : undefined,
    occurrences_recent: r.occurrences_recent != null ? Number(r.occurrences_recent) : undefined,
    occurrences_previous: r.occurrences_previous != null ? Number(r.occurrences_previous) : undefined,
    trend_ratio: r.trend_ratio != null ? Number(r.trend_ratio) : undefined,
  };
}

function buildWhereSql(f: ErrorListFilterInput, projectId: string): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`eg.project_id = ${projectId}`];
  if (f.appId) parts.push(Prisma.sql`eg.app = ${f.appId}`);
  if (f.environment) parts.push(Prisma.sql`eg.environment = ${f.environment}`);
  if (f.q) {
    const pat = `%${escapeLikePattern(f.q)}%`;
    parts.push(Prisma.sql`eg.message ILIKE ${pat} ESCAPE '\\'`);
  }
  if (f.range.gte) parts.push(Prisma.sql`eg.last_seen >= ${f.range.gte}`);
  if (f.range.lte) parts.push(Prisma.sql`eg.last_seen <= ${f.range.lte}`);
  if (f.status === "unresolved") parts.push(Prisma.sql`eg.resolved_at IS NULL`);
  if (f.status === "resolved") parts.push(Prisma.sql`eg.resolved_at IS NOT NULL`);
  if (f.release) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM "ErrorOccurrence" rel
        WHERE rel.error_group_id = eg.id
          AND rel.release = ${f.release}
      )`
    );
  }
  return Prisma.join(parts, " AND ");
}

function occurrenceInRangeExpr(f: ErrorListFilterInput, alias = "o"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"."created_at"`);
  const gte = f.range.gte ?? f.occurrenceCountRange?.gte;
  const lte = f.range.lte ?? f.occurrenceCountRange?.lte;
  const parts: Prisma.Sql[] = [];
  if (gte) parts.push(Prisma.sql`${a} >= ${gte}`);
  if (lte) parts.push(Prisma.sql`${a} <= ${lte}`);
  if (parts.length === 0) {
    return Prisma.sql`0::bigint`;
  }
  return Prisma.sql`SUM(CASE WHEN ${Prisma.join(parts, " AND ")} THEN 1 ELSE 0 END)::bigint`;
}

function aggregateJoinSql(
  f: ErrorListFilterInput,
  recentStart: Date,
  prevStart: Date,
  end: Date
): Prisma.Sql {
  const releaseClause = f.release
    ? Prisma.sql`AND o.release = ${f.release}`
    : Prisma.empty;
  const inRangeExpr = occurrenceInRangeExpr(f, "o");

  return Prisma.sql`
  LEFT JOIN (
    SELECT
      o.error_group_id,
      COUNT(DISTINCT COALESCE(
        NULLIF(TRIM(COALESCE(o.user_id, '')), ''),
        NULLIF(TRIM(COALESCE(o.anonymous_id, '')), ''),
        NULLIF(TRIM(COALESCE(o.session_id, '')), '')
      )) AS users_affected,
      COUNT(DISTINCT o.session_id) FILTER (
        WHERE o.session_id IS NOT NULL AND TRIM(o.session_id) <> ''
      ) AS sessions_affected,
      SUM(CASE WHEN o.created_at >= ${recentStart} AND o.created_at < ${end} THEN 1 ELSE 0 END)::bigint AS occurrences_recent,
      SUM(CASE WHEN o.created_at >= ${prevStart} AND o.created_at < ${recentStart} THEN 1 ELSE 0 END)::bigint AS occurrences_previous,
      ${inRangeExpr} AS occurrences_in_range
    FROM "ErrorOccurrence" o
    WHERE TRUE ${releaseClause}
    GROUP BY o.error_group_id
  ) agg ON agg.error_group_id = eg.id`;
}

function orderByAggregateSql(
  sort: ErrorListSort,
  order: ErrorListOrder
): Prisma.Sql {
  const dir = order === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const nulls = order === "asc" ? Prisma.sql`NULLS FIRST` : Prisma.sql`NULLS LAST`;
  if (sort === "users") {
    return Prisma.sql`ORDER BY COALESCE(agg.users_affected, 0) ${dir} ${nulls}`;
  }
  if (sort === "sessions") {
    return Prisma.sql`ORDER BY COALESCE(agg.sessions_affected, 0) ${dir} ${nulls}`;
  }
  if (sort === "occurrences") {
    return Prisma.sql`ORDER BY COALESCE(agg.occurrences_in_range, 0) ${dir} ${nulls}, eg.last_seen DESC`;
  }
  const trendExpr = Prisma.sql`(COALESCE(agg.occurrences_recent, 0)::float / GREATEST(COALESCE(agg.occurrences_previous, 0), 1))`;
  return Prisma.sql`ORDER BY ${trendExpr} ${dir} ${nulls}, eg.last_seen DESC`;
}

export async function listErrorGroupsAggregated(
  prisma: PrismaClient,
  f: ErrorListFilterInput,
  projectId: string,
  sort: ErrorListSort,
  order: ErrorListOrder,
  trendW: number,
  trendEnd: Date,
  skip: number,
  take: number
): Promise<{ total: number; rows: ErrorGroupListRow[] }> {
  const W = trendW;
  const end = trendEnd;
  const recentStart = new Date(end.getTime() - W);
  const prevStart = new Date(end.getTime() - 2 * W);

  const whereSql = buildWhereSql(f, projectId);
  const joinSql = aggregateJoinSql(f, recentStart, prevStart, end);
  const orderSql = orderByAggregateSql(sort, order);

  const countRows = await prisma.$queryRaw<[{ c: bigint }]>(
    Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "ErrorGroup" eg WHERE ${whereSql}`
  );
  const total = Number(countRows[0]?.c ?? 0);

  const dataRows = await prisma.$queryRaw<Record<string, unknown>[]>(
    Prisma.sql`
    SELECT
      eg.id,
      eg.fingerprint,
      eg.message,
      eg.top_stack,
      eg.app,
      eg.environment,
      eg.occurrences,
      COALESCE(agg.occurrences_in_range, 0)::int AS occurrences_in_range,
      eg.first_seen,
      eg.last_seen,
      eg.resolved_at,
      COALESCE(agg.users_affected, 0)::int AS users_affected,
      COALESCE(agg.sessions_affected, 0)::int AS sessions_affected,
      COALESCE(agg.occurrences_recent, 0)::int AS occurrences_recent,
      COALESCE(agg.occurrences_previous, 0)::int AS occurrences_previous,
      (COALESCE(agg.occurrences_recent, 0)::float / GREATEST(COALESCE(agg.occurrences_previous, 0), 1)) AS trend_ratio
    FROM "ErrorGroup" eg
    ${joinSql}
    WHERE ${whereSql}
    ${orderSql}
    LIMIT ${take} OFFSET ${skip}
  `
  );

  const rows = dataRows.map((r) => mapRawRow(r));

  return { total, rows };
}

/** Batch metrics for a page of group IDs (Prisma scalar list path). */
export async function fetchMetricsForGroupIds(
  prisma: PrismaClient,
  ids: string[],
  trendDurationMs: number,
  trendEnd: Date,
  f?: Pick<ErrorListFilterInput, "range" | "release" | "occurrenceCountRange">
): Promise<
  Map<
    string,
    Pick<
      ErrorGroupListRow,
      | "users_affected"
      | "sessions_affected"
      | "occurrences_recent"
      | "occurrences_previous"
      | "trend_ratio"
      | "occurrences_in_range"
    >
  >
> {
  const out = new Map<
    string,
    Pick<
      ErrorGroupListRow,
      | "users_affected"
      | "sessions_affected"
      | "occurrences_recent"
      | "occurrences_previous"
      | "trend_ratio"
      | "occurrences_in_range"
    >
  >();
  if (ids.length === 0) return out;

  const W = trendDurationMs;
  const end = trendEnd;
  const recentStart = new Date(end.getTime() - W);
  const prevStart = new Date(end.getTime() - 2 * W);
  const filter: ErrorListFilterInput = {
    range: f?.range ?? {},
    release: f?.release,
    occurrenceCountRange: f?.occurrenceCountRange,
    status: "all",
  };
  const releaseClause = filter.release
    ? Prisma.sql`AND o.release = ${filter.release}`
    : Prisma.empty;
  const inRangeExpr = occurrenceInRangeExpr(filter, "o");

  const idList = ids.map((id) => Prisma.sql`${id}`);
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>(
    Prisma.sql`
    SELECT
      o.error_group_id AS id,
      COUNT(DISTINCT COALESCE(
        NULLIF(TRIM(COALESCE(o.user_id, '')), ''),
        NULLIF(TRIM(COALESCE(o.anonymous_id, '')), ''),
        NULLIF(TRIM(COALESCE(o.session_id, '')), '')
      ))::int AS users_affected,
      COUNT(DISTINCT o.session_id) FILTER (
        WHERE o.session_id IS NOT NULL AND TRIM(o.session_id) <> ''
      )::int AS sessions_affected,
      SUM(CASE WHEN o.created_at >= ${recentStart} AND o.created_at < ${end} THEN 1 ELSE 0 END)::bigint AS occurrences_recent,
      SUM(CASE WHEN o.created_at >= ${prevStart} AND o.created_at < ${recentStart} THEN 1 ELSE 0 END)::bigint AS occurrences_previous,
      ${inRangeExpr} AS occurrences_in_range
    FROM "ErrorOccurrence" o
    WHERE o.error_group_id IN (${Prisma.join(idList)})
      ${releaseClause}
    GROUP BY o.error_group_id
  `
  );

  for (const r of rows) {
    const id = String(r.id);
    const occR = Number(r.occurrences_recent ?? 0);
    const occP = Number(r.occurrences_previous ?? 0);
    out.set(id, {
      users_affected: Number(r.users_affected ?? 0),
      sessions_affected: Number(r.sessions_affected ?? 0),
      occurrences_recent: occR,
      occurrences_previous: occP,
      trend_ratio: occR / Math.max(occP, 1),
      occurrences_in_range:
        r.occurrences_in_range != null ? Number(r.occurrences_in_range) : undefined,
    });
  }
  return out;
}

/** Distinct users/sessions impacted by all occurrences in one error group. */
export async function fetchImpactMetricsForGroupId(
  prisma: PrismaClient,
  errorGroupId: string
): Promise<{ users_affected: number; sessions_affected: number }> {
  const rows = await prisma.$queryRaw<
    [{ users_affected: number | bigint | null; sessions_affected: number | bigint | null }]
  >(Prisma.sql`
    SELECT
      COUNT(DISTINCT COALESCE(
        NULLIF(TRIM(COALESCE(o.user_id, '')), ''),
        NULLIF(TRIM(COALESCE(o.anonymous_id, '')), ''),
        NULLIF(TRIM(COALESCE(o.session_id, '')), '')
      ))::int AS users_affected,
      COUNT(DISTINCT o.session_id) FILTER (
        WHERE o.session_id IS NOT NULL AND TRIM(o.session_id) <> ''
      )::int AS sessions_affected
    FROM "ErrorOccurrence" o
    WHERE o.error_group_id = ${errorGroupId}
  `);
  return {
    users_affected: Number(rows[0]?.users_affected ?? 0),
    sessions_affected: Number(rows[0]?.sessions_affected ?? 0),
  };
}

export async function listErrorGroupsPrisma(
  prisma: PrismaClient,
  f: ErrorListFilterInput,
  projectId: string,
  sort: ScalarErrorListSort,
  order: ErrorListOrder,
  skip: number,
  take: number
): Promise<{
  total: number;
  groups: (Prisma.ErrorGroupGetPayload<{
    include: { _count: { select: { occurrences_list: true } } };
  }>)[];
}> {
  const where = buildErrorGroupWhereInput(f, projectId);
  const orderBy = prismaOrderBy(sort, order);
  const [total, groups] = await Promise.all([
    prisma.errorGroup.count({ where }),
    prisma.errorGroup.findMany({
      where,
      skip,
      take,
      orderBy,
      include: { _count: { select: { occurrences_list: true } } },
    }),
  ]);
  return { total, groups };
}

export function serializeErrorGroupListItem(
  row: ErrorGroupListRow
): Record<string, unknown> {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    message: row.message,
    top_stack: row.top_stack,
    app: row.app,
    environment: row.environment,
    occurrences: row.occurrences,
    occurrences_in_range: row.occurrences_in_range ?? 0,
    first_seen: row.first_seen.toISOString(),
    last_seen: row.last_seen.toISOString(),
    resolved_at: row.resolved_at?.toISOString() ?? null,
    users_affected: row.users_affected,
    sessions_affected: row.sessions_affected,
    occurrences_recent: row.occurrences_recent,
    occurrences_previous: row.occurrences_previous,
    trend_ratio: row.trend_ratio,
  };
}
