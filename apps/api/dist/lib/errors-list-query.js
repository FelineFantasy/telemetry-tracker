/**
 * Error group list: sorting, aggregates (users/sessions/trend), and SQL helpers.
 *
 * Trend score for sorting: `occurrences_recent / max(occurrences_previous, 1)` — higher means
 * more activity in the recent window vs the previous window of equal length.
 */
import { Prisma } from "@prisma/client";
import { escapeLikePattern } from "./list-query.js";
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
];
/** Omitted → default; invalid when present → validation fails (400). */
export function parseErrorListSortParam(value) {
    if (value === undefined || value.trim() === "") {
        return { ok: true, sort: "last_seen" };
    }
    const v = value.trim();
    if (ERROR_LIST_SORTS.includes(v)) {
        return { ok: true, sort: v };
    }
    return { ok: false };
}
export function parseErrorListOrderParam(value) {
    if (value === undefined || value.trim() === "") {
        return { ok: true, order: "desc" };
    }
    const v = value.trim();
    if (v === "asc" || v === "desc") {
        return { ok: true, order: v };
    }
    return { ok: false };
}
export function parseTrendWindowParam(value) {
    if (value === undefined || value.trim() === "") {
        return { ok: true, trendWindow: "24h" };
    }
    const v = value.trim();
    if (v === "24h" || v === "7d") {
        return { ok: true, trendWindow: v };
    }
    return { ok: false };
}
export function trendWindowDurationMs(w) {
    return w === "7d" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}
export function buildErrorGroupWhereInput(f) {
    const where = {};
    if (f.appId)
        where.app = f.appId;
    if (f.environment)
        where.environment = f.environment;
    if (f.q)
        where.message = { contains: f.q, mode: "insensitive" };
    if (f.range.gte || f.range.lte) {
        where.last_seen = {};
        if (f.range.gte)
            where.last_seen.gte = f.range.gte;
        if (f.range.lte)
            where.last_seen.lte = f.range.lte;
    }
    if (f.status === "unresolved")
        where.resolved_at = null;
    if (f.status === "resolved")
        where.resolved_at = { not: null };
    return where;
}
function prismaOrderBy(sort, order) {
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
/** Scalar sorts only — users/sessions/trend use raw SQL. */
export function isAggregateSort(sort) {
    return sort === "users" || sort === "sessions" || sort === "trend";
}
function mapRawRow(r) {
    return {
        id: String(r.id),
        fingerprint: String(r.fingerprint),
        message: String(r.message),
        top_stack: r.top_stack != null ? String(r.top_stack) : null,
        app: String(r.app),
        environment: r.environment != null ? String(r.environment) : null,
        occurrences: Number(r.occurrences),
        first_seen: r.first_seen,
        last_seen: r.last_seen,
        resolved_at: r.resolved_at != null ? r.resolved_at : null,
        users_affected: r.users_affected != null ? Number(r.users_affected) : undefined,
        sessions_affected: r.sessions_affected != null ? Number(r.sessions_affected) : undefined,
        occurrences_recent: r.occurrences_recent != null ? Number(r.occurrences_recent) : undefined,
        occurrences_previous: r.occurrences_previous != null ? Number(r.occurrences_previous) : undefined,
        trend_ratio: r.trend_ratio != null ? Number(r.trend_ratio) : undefined,
    };
}
function buildWhereSql(f) {
    const parts = [Prisma.sql `TRUE`];
    if (f.appId)
        parts.push(Prisma.sql `eg.app = ${f.appId}`);
    if (f.environment)
        parts.push(Prisma.sql `eg.environment = ${f.environment}`);
    if (f.q) {
        const pat = `%${escapeLikePattern(f.q)}%`;
        parts.push(Prisma.sql `eg.message ILIKE ${pat} ESCAPE '\\'`);
    }
    if (f.range.gte)
        parts.push(Prisma.sql `eg.last_seen >= ${f.range.gte}`);
    if (f.range.lte)
        parts.push(Prisma.sql `eg.last_seen <= ${f.range.lte}`);
    if (f.status === "unresolved")
        parts.push(Prisma.sql `eg.resolved_at IS NULL`);
    if (f.status === "resolved")
        parts.push(Prisma.sql `eg.resolved_at IS NOT NULL`);
    return Prisma.join(parts, " AND ");
}
function aggregateJoinSql(recentStart, prevStart, end) {
    return Prisma.sql `
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
      SUM(CASE WHEN o.created_at >= ${prevStart} AND o.created_at < ${recentStart} THEN 1 ELSE 0 END)::bigint AS occurrences_previous
    FROM "ErrorOccurrence" o
    GROUP BY o.error_group_id
  ) agg ON agg.error_group_id = eg.id`;
}
function orderByAggregateSql(sort, order) {
    const dir = order === "asc" ? Prisma.sql `ASC` : Prisma.sql `DESC`;
    const nulls = order === "asc" ? Prisma.sql `NULLS FIRST` : Prisma.sql `NULLS LAST`;
    if (sort === "users") {
        return Prisma.sql `ORDER BY COALESCE(agg.users_affected, 0) ${dir} ${nulls}`;
    }
    if (sort === "sessions") {
        return Prisma.sql `ORDER BY COALESCE(agg.sessions_affected, 0) ${dir} ${nulls}`;
    }
    const trendExpr = Prisma.sql `(COALESCE(agg.occurrences_recent, 0)::float / GREATEST(COALESCE(agg.occurrences_previous, 0), 1))`;
    return Prisma.sql `ORDER BY ${trendExpr} ${dir} ${nulls}, eg.last_seen DESC`;
}
export async function listErrorGroupsAggregated(prisma, f, sort, order, trendW, trendEnd, skip, take) {
    const W = trendWindowDurationMs(trendW);
    const end = trendEnd;
    const recentStart = new Date(end.getTime() - W);
    const prevStart = new Date(end.getTime() - 2 * W);
    const whereSql = buildWhereSql(f);
    const joinSql = aggregateJoinSql(recentStart, prevStart, end);
    const orderSql = orderByAggregateSql(sort, order);
    const countRows = await prisma.$queryRaw(Prisma.sql `SELECT COUNT(*)::bigint AS c FROM "ErrorGroup" eg WHERE ${whereSql}`);
    const total = Number(countRows[0]?.c ?? 0);
    const dataRows = await prisma.$queryRaw(Prisma.sql `
    SELECT
      eg.id,
      eg.fingerprint,
      eg.message,
      eg.top_stack,
      eg.app,
      eg.environment,
      eg.occurrences,
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
  `);
    const rows = dataRows.map((r) => mapRawRow(r));
    return { total, rows };
}
/** Batch metrics for a page of group IDs (Prisma scalar list path). */
export async function fetchMetricsForGroupIds(prisma, ids, trendW, trendEnd) {
    const out = new Map();
    if (ids.length === 0)
        return out;
    const W = trendWindowDurationMs(trendW);
    const end = trendEnd;
    const recentStart = new Date(end.getTime() - W);
    const prevStart = new Date(end.getTime() - 2 * W);
    const idList = ids.map((id) => Prisma.sql `${id}`);
    const rows = await prisma.$queryRaw(Prisma.sql `
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
      SUM(CASE WHEN o.created_at >= ${prevStart} AND o.created_at < ${recentStart} THEN 1 ELSE 0 END)::bigint AS occurrences_previous
    FROM "ErrorOccurrence" o
    WHERE o.error_group_id IN (${Prisma.join(idList)})
    GROUP BY o.error_group_id
  `);
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
        });
    }
    return out;
}
export async function listErrorGroupsPrisma(prisma, f, sort, order, skip, take) {
    const where = buildErrorGroupWhereInput(f);
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
export function serializeErrorGroupListItem(row) {
    return {
        id: row.id,
        fingerprint: row.fingerprint,
        message: row.message,
        top_stack: row.top_stack,
        app: row.app,
        environment: row.environment,
        occurrences: row.occurrences,
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
