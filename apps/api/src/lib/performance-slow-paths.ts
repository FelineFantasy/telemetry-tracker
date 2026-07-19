/**
 * Slow routes ($request) and slow pages ($web_vital) tables for Performance (#196).
 */

import { Prisma, PrismaClient } from "@prisma/client";
import {
  REQUEST_EVENT_NAME,
  requestDurationMsExpr,
} from "./overview-kpi.js";
import {
  type PerformanceFilterInput,
  type ResolvedSummaryWindow,
  WEB_VITAL_EVENT_NAME,
  roundWebVitalValue,
  webVitalMetricKeySql,
  webVitalValueExpr,
} from "./performance-page-summary.js";
import { releaseFilterMatchSql } from "./release-key.js";

/** Rows below this LCP (or request) sample count are flagged as small samples. */
export const PERFORMANCE_SMALL_SAMPLE_THRESHOLD = 5;

export type SlowRouteRow = {
  method: string;
  url: string;
  count: number;
  p50Ms: number | null;
  p95Ms: number | null;
  errorRatePct: number | null;
  smallSample: boolean;
};

export type SlowPageRow = {
  path: string;
  lcpP75: number | null;
  clsP75: number | null;
  sampleCount: number;
  smallSample: boolean;
};

export type SlowPathsListResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  window: {
    since: string;
    until: string;
    label: string;
  };
};

function performanceEventFilterSql(
  f: PerformanceFilterInput,
  projectId: string
): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`e."project_id" = ${projectId}`];
  if (f.appId) parts.push(Prisma.sql`e."app" = ${f.appId}`);
  if (f.environment) parts.push(Prisma.sql`e."environment" = ${f.environment}`);
  if (f.platform) parts.push(Prisma.sql`e."platform" = ${f.platform}`);
  if (f.release) parts.push(releaseFilterMatchSql(Prisma.sql`e."release"`, f.release));
  return Prisma.join(parts, " AND ");
}

/** HTTP method from `$request` properties (defaults to GET when blank). */
export function requestMethodExpr(alias = "e"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`UPPER(NULLIF(TRIM(COALESCE(${a}."properties"->>'method', '')), ''))`;
}

/**
 * Path/URL for route grouping: strip query string from `url` (or `path` fallback).
 */
export function requestUrlPathExpr(alias = "e"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`NULLIF(TRIM(SPLIT_PART(
    COALESCE(
      NULLIF(TRIM(COALESCE(${a}."properties"->>'url', '')), ''),
      NULLIF(TRIM(COALESCE(${a}."properties"->>'path', '')), ''),
      ''
    ),
    '?',
    1
  )), '')`;
}

/** Numeric HTTP status from optional `status_code` / `status` properties. */
export function requestStatusCodeExpr(alias = "e"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`CASE
    WHEN ${a}."properties"->>'status_code' ~ '^[0-9]+$'
    THEN (${a}."properties"->>'status_code')::integer
    WHEN ${a}."properties"->>'status' ~ '^[0-9]+$'
    THEN (${a}."properties"->>'status')::integer
  END`;
}

/** Page path from `$web_vital` properties. */
export function webVitalPathExpr(alias = "e"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`NULLIF(TRIM(COALESCE(${a}."properties"->>'path', '')), '')`;
}

export function isSmallSample(
  sampleCount: number,
  threshold = PERFORMANCE_SMALL_SAMPLE_THRESHOLD
): boolean {
  return sampleCount > 0 && sampleCount < threshold;
}

/** Error rate % when at least one request has a status; otherwise null. */
export function computeErrorRatePct(
  errorCount: number,
  statusSampleCount: number
): number | null {
  if (statusSampleCount <= 0) return null;
  return Math.round((errorCount / statusSampleCount) * 1000) / 10;
}

export function compareSlowRoutes(a: SlowRouteRow, b: SlowRouteRow): number {
  const p95A = a.p95Ms ?? Number.NEGATIVE_INFINITY;
  const p95B = b.p95Ms ?? Number.NEGATIVE_INFINITY;
  if (p95A !== p95B) return p95B - p95A;
  const p50A = a.p50Ms ?? Number.NEGATIVE_INFINITY;
  const p50B = b.p50Ms ?? Number.NEGATIVE_INFINITY;
  if (p50A !== p50B) return p50B - p50A;
  if (a.count !== b.count) return b.count - a.count;
  const methodCmp = a.method.localeCompare(b.method);
  if (methodCmp !== 0) return methodCmp;
  return a.url.localeCompare(b.url);
}

export function compareSlowPages(a: SlowPageRow, b: SlowPageRow): number {
  const lcpA = a.lcpP75 ?? Number.NEGATIVE_INFINITY;
  const lcpB = b.lcpP75 ?? Number.NEGATIVE_INFINITY;
  if (lcpA !== lcpB) return lcpB - lcpA;
  if (a.sampleCount !== b.sampleCount) return b.sampleCount - a.sampleCount;
  return a.path.localeCompare(b.path);
}

export function sortSlowRoutes(rows: SlowRouteRow[]): SlowRouteRow[] {
  return [...rows].sort(compareSlowRoutes);
}

export function sortSlowPages(rows: SlowPageRow[]): SlowPageRow[] {
  return [...rows].sort(compareSlowPages);
}

export function paginateRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number
): { items: T[]; total: number; page: number; pageSize: number } {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const safeSize =
    Number.isFinite(pageSize) && pageSize >= 1 ? Math.floor(pageSize) : 20;
  const total = rows.length;
  const maxPage = Math.max(1, Math.ceil(total / safeSize) || 1);
  const clampedPage = Math.min(safePage, maxPage);
  const start = (clampedPage - 1) * safeSize;
  return {
    items: rows.slice(start, start + safeSize),
    total,
    page: clampedPage,
    pageSize: safeSize,
  };
}

type SlowRouteSqlRow = {
  method: string | null;
  url: string | null;
  request_count: bigint;
  p50_ms: number | null;
  p95_ms: number | null;
  error_count: bigint;
  status_sample_count: bigint;
};

type SlowPageSqlRow = {
  path: string | null;
  lcp_p75: number | null;
  cls_p75: number | null;
  sample_count: bigint;
};

function mapSlowRouteRow(row: SlowRouteSqlRow): SlowRouteRow | null {
  const url = row.url?.trim() || "";
  if (!url) return null;
  const method = (row.method?.trim() || "GET").toUpperCase();
  const count = Number(row.request_count);
  const statusSampleCount = Number(row.status_sample_count);
  const errorCount = Number(row.error_count);
  return {
    method,
    url,
    count,
    p50Ms: row.p50_ms == null ? null : Math.round(Number(row.p50_ms)),
    p95Ms: row.p95_ms == null ? null : Math.round(Number(row.p95_ms)),
    errorRatePct: computeErrorRatePct(errorCount, statusSampleCount),
    smallSample: isSmallSample(count),
  };
}

function mapSlowPageRow(row: SlowPageSqlRow): SlowPageRow | null {
  const path = row.path?.trim() || "";
  if (!path) return null;
  const sampleCount = Number(row.sample_count);
  return {
    path,
    lcpP75: roundWebVitalValue("LCP", row.lcp_p75),
    clsP75: roundWebVitalValue("CLS", row.cls_p75),
    sampleCount,
    smallSample: isSmallSample(sampleCount),
  };
}

export async function fetchSlowRoutes(
  prisma: PrismaClient,
  f: PerformanceFilterInput,
  projectId: string,
  window: ResolvedSummaryWindow,
  page: number,
  pageSize: number
): Promise<SlowPathsListResult<SlowRouteRow>> {
  const { since, until, label } = window;
  const filters = performanceEventFilterSql(f, projectId);
  const duration = requestDurationMsExpr("e");
  const method = requestMethodExpr("e");
  const url = requestUrlPathExpr("e");
  const status = requestStatusCodeExpr("e");

  const rows = await prisma.$queryRaw<SlowRouteSqlRow[]>(Prisma.sql`
    SELECT
      COALESCE(${method}, 'GET') AS method,
      ${url} AS url,
      COUNT(*)::bigint AS request_count,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${duration})
        FILTER (WHERE ${duration} IS NOT NULL) AS p50_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${duration})
        FILTER (WHERE ${duration} IS NOT NULL) AS p95_ms,
      COUNT(*) FILTER (WHERE ${status} IS NOT NULL AND ${status} >= 400)::bigint AS error_count,
      COUNT(*) FILTER (WHERE ${status} IS NOT NULL)::bigint AS status_sample_count
    FROM "Event" e
    WHERE ${filters}
      AND e."name" = ${REQUEST_EVENT_NAME}
      AND e."created_at" >= ${since}
      AND e."created_at" <= ${until}
      AND ${url} IS NOT NULL
    GROUP BY 1, 2
  `);

  const mapped = rows
    .map(mapSlowRouteRow)
    .filter((row): row is SlowRouteRow => row != null);
  const sorted = sortSlowRoutes(mapped);
  const paged = paginateRows(sorted, page, pageSize);

  return {
    ...paged,
    window: {
      since: since.toISOString(),
      until: until.toISOString(),
      label,
    },
  };
}

export async function fetchSlowPages(
  prisma: PrismaClient,
  f: PerformanceFilterInput,
  projectId: string,
  window: ResolvedSummaryWindow,
  page: number,
  pageSize: number
): Promise<SlowPathsListResult<SlowPageRow>> {
  const { since, until, label } = window;
  const filters = performanceEventFilterSql(f, projectId);
  const value = webVitalValueExpr("e");
  const metricKey = webVitalMetricKeySql("e");
  const path = webVitalPathExpr("e");

  const rows = await prisma.$queryRaw<SlowPageSqlRow[]>(Prisma.sql`
    SELECT
      ${path} AS path,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${value})
        FILTER (WHERE ${metricKey} = 'LCP') AS lcp_p75,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${value})
        FILTER (WHERE ${metricKey} = 'CLS') AS cls_p75,
      COUNT(*) FILTER (WHERE ${metricKey} = 'LCP')::bigint AS sample_count
    FROM "Event" e
    WHERE ${filters}
      AND e."name" = ${WEB_VITAL_EVENT_NAME}
      AND e."created_at" >= ${since}
      AND e."created_at" <= ${until}
      AND ${path} IS NOT NULL
      AND ${metricKey} IN ('LCP', 'CLS')
      AND ${value} IS NOT NULL
    GROUP BY 1
    HAVING COUNT(*) FILTER (WHERE ${metricKey} = 'LCP') > 0
  `);

  const mapped = rows
    .map(mapSlowPageRow)
    .filter((row): row is SlowPageRow => row != null);
  const sorted = sortSlowPages(mapped);
  const paged = paginateRows(sorted, page, pageSize);

  return {
    ...paged,
    window: {
      since: since.toISOString(),
      until: until.toISOString(),
      label,
    },
  };
}
