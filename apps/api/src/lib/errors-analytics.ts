/**
 * Errors page analytics: stacked errors-over-time by type and top types with sparklines.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import {
  ERROR_TYPES,
  type ErrorType,
  errorTypeSqlExpression,
} from "./error-type.js";
import {
  buildErrorOccurrenceFilterSql,
} from "./errors-page-summary.js";
import type { ErrorListFilterInput } from "./errors-list-query.js";
import type { ResolvedSummaryWindow } from "./errors-page-summary.js";
import {
  generateOverviewChartBuckets,
  overviewChartQuerySince,
  type OverviewSeriesBucket,
} from "./overview-timeseries.js";
import { chooseTimeRangeBucket } from "./time-range.js";

export const ERRORS_TOP_TYPES_LIMIT = 5;

export type ErrorsAnalyticsSparklinePoint = {
  t: string;
  count: number;
};

export type ErrorsStackedPoint = {
  t: string;
} & Record<ErrorType, number>;

export type ErrorsTopTypeRow = {
  type: ErrorType;
  count: number;
  sharePct: number;
  sparkline: ErrorsAnalyticsSparklinePoint[];
};

export type ErrorsAnalytics = {
  window: {
    since: string;
    until: string;
    label: string;
  };
  /** Rendered chart range — may be shorter than `window` when bucket cap applies. */
  chartWindow: {
    since: string;
    until: string;
  };
  bucket: OverviewSeriesBucket;
  stacked: ErrorsStackedPoint[];
  topTypes: ErrorsTopTypeRow[];
};

type BucketTypeRow = {
  bucket: Date;
  error_type: string;
  c: bigint;
};

function emptyStackedPoint(t: string): ErrorsStackedPoint {
  return {
    t,
    TypeError: 0,
    ReferenceError: 0,
    "Network Error": 0,
    "Validation Error": 0,
    Other: 0,
  };
}

function isErrorType(value: string): value is ErrorType {
  return (ERROR_TYPES as readonly string[]).includes(value);
}

/** Aggregate occurrence counts by type for the full KPI window (not chart-capped). */
export function mergeErrorTypeTotals(
  rows: { error_type: string; count: number }[]
): Map<ErrorType, number> {
  const totals = new Map<ErrorType, number>();
  for (const t of ERROR_TYPES) totals.set(t, 0);
  for (const row of rows) {
    if (!isErrorType(row.error_type)) continue;
    totals.set(row.error_type, (totals.get(row.error_type) ?? 0) + row.count);
  }
  return totals;
}

/** Merge raw bucket rows into stacked series and per-type sparkline maps. */
export function mergeErrorsByTypeBuckets(
  expectedBuckets: Date[],
  rows: { bucket: Date; error_type: string; count: number }[]
): {
  stacked: ErrorsStackedPoint[];
  byType: Map<ErrorType, ErrorsAnalyticsSparklinePoint[]>;
  totals: Map<ErrorType, number>;
} {
  const byBucket = new Map<string, ErrorsStackedPoint>();
  for (const d of expectedBuckets) {
    byBucket.set(d.toISOString(), emptyStackedPoint(d.toISOString()));
  }

  const totals = new Map<ErrorType, number>();
  for (const t of ERROR_TYPES) totals.set(t, 0);

  for (const row of rows) {
    const key = row.bucket.toISOString();
    const point = byBucket.get(key);
    if (!point || !isErrorType(row.error_type)) continue;
    point[row.error_type] += row.count;
    totals.set(row.error_type, (totals.get(row.error_type) ?? 0) + row.count);
  }

  const stacked = expectedBuckets.map((d) => byBucket.get(d.toISOString())!);
  const byType = new Map<ErrorType, ErrorsAnalyticsSparklinePoint[]>();
  for (const type of ERROR_TYPES) {
    byType.set(
      type,
      stacked.map((p) => ({ t: p.t, count: p[type] }))
    );
  }

  return { stacked, byType, totals };
}

/** Rank types by occurrence count and attach sparkline series. */
export function buildTopErrorTypes(
  totals: Map<ErrorType, number>,
  byType: Map<ErrorType, ErrorsAnalyticsSparklinePoint[]>,
  limit = ERRORS_TOP_TYPES_LIMIT
): ErrorsTopTypeRow[] {
  const grandTotal = [...totals.values()].reduce((a, b) => a + b, 0);
  const ranked = [...totals.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return ranked.map(([type, count]) => ({
    type,
    count,
    sharePct: grandTotal > 0 ? (count / grandTotal) * 100 : 0,
    sparkline: byType.get(type) ?? [],
  }));
}

export async function fetchErrorsAnalytics(
  prisma: PrismaClient,
  f: ErrorListFilterInput,
  projectId: string,
  window: ResolvedSummaryWindow
): Promise<ErrorsAnalytics> {
  const { since, until } = window;
  const durationMs = Math.max(until.getTime() - since.getTime(), 1);
  const { bucket } = chooseTimeRangeBucket(durationMs);
  const expectedBuckets = generateOverviewChartBuckets(since, until, bucket);
  const chartSince = expectedBuckets[0] ?? since;
  const querySince = overviewChartQuerySince(since, until, bucket);

  const occurrenceFilter = buildErrorOccurrenceFilterSql(f, projectId);
  const typeExpr = errorTypeSqlExpression("eg");
  const releaseClause = f.release
    ? Prisma.sql`AND eo."release" = ${f.release}`
    : Prisma.empty;

  const [bucketRows, totalRows] = await Promise.all([
    prisma.$queryRaw<BucketTypeRow[]>(Prisma.sql`
      SELECT
        (date_trunc(${bucket}, eo."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
        ${typeExpr} AS error_type,
        COUNT(*)::bigint AS c
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eg."id" = eo."error_group_id"
      WHERE ${occurrenceFilter}
        ${releaseClause}
        AND eo."created_at" >= ${querySince}
        AND eo."created_at" <= ${until}
      GROUP BY 1, 2
      ORDER BY 1
    `),
    prisma.$queryRaw<{ error_type: string; c: bigint }[]>(Prisma.sql`
      SELECT
        ${typeExpr} AS error_type,
        COUNT(*)::bigint AS c
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eg."id" = eo."error_group_id"
      WHERE ${occurrenceFilter}
        ${releaseClause}
        AND eo."created_at" >= ${since}
        AND eo."created_at" <= ${until}
      GROUP BY 1
    `),
  ]);

  const normalized = bucketRows.map((r) => ({
    bucket: r.bucket,
    error_type: String(r.error_type),
    count: Number(r.c),
  }));

  const { stacked, byType } = mergeErrorsByTypeBuckets(expectedBuckets, normalized);
  const totals = mergeErrorTypeTotals(
    totalRows.map((r) => ({
      error_type: String(r.error_type),
      count: Number(r.c),
    }))
  );
  const topTypes = buildTopErrorTypes(totals, byType);

  return {
    window: {
      since: since.toISOString(),
      until: until.toISOString(),
      label: window.label,
    },
    chartWindow: {
      since: chartSince.toISOString(),
      until: until.toISOString(),
    },
    bucket,
    stacked,
    topTypes,
  };
}
