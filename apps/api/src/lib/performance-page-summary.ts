/**
 * Performance page summary: Web Vitals aggregates, rating distribution,
 * time series, and Node `$request` latency (avg, p95, Apdex).
 */

import { Prisma, PrismaClient } from "@prisma/client";
import {
  apdexPctFromScore,
  apdexScore,
  avgResponseMsForBucket,
  REQUEST_APDEX_THRESHOLD_MS,
  REQUEST_EVENT_NAME,
  requestDurationMsExpr,
} from "./overview-kpi.js";
import {
  generateOverviewChartBuckets,
  overviewChartQuerySince,
  type OverviewSeriesBucket,
} from "./overview-timeseries.js";
import { resolveCompareWindow } from "./overview-stats.js";
import { chooseTimeRangeBucket } from "./time-range.js";

export const WEB_VITAL_EVENT_NAME = "$web_vital";

export const PERFORMANCE_VITAL_KEYS = ["LCP", "INP", "CLS", "TTFB"] as const;

export type PerformanceVitalKey = (typeof PERFORMANCE_VITAL_KEYS)[number];

export type WebVitalRatingBand = "good" | "needs-improvement" | "poor";

export type PerformanceFilterInput = {
  appId?: string;
  platform?: string;
  environment?: string;
  release?: string;
  range: { gte?: Date; lte?: Date };
};

export type PerformanceSparklinePoint = {
  t: string;
  value: number | null;
};

export type WebVitalRatingDistribution = {
  good: number;
  needsImprovement: number;
  poor: number;
  goodPct: number;
  needsImprovementPct: number;
  poorPct: number;
  total: number;
};

export type WebVitalMetricSummary = {
  metric: PerformanceVitalKey;
  sampleCount: number;
  p75: number | null;
  p95: number | null;
  rating: WebVitalRatingDistribution;
  series: PerformanceSparklinePoint[];
};

export type PerformanceRequestLatency = {
  available: false;
} | {
  available: true;
  avgMs: number;
  avgMsPrevious: number | null;
  p95Ms: number;
  p95MsPrevious: number | null;
  apdex: number;
  apdexPct: number;
  apdexPrevious: number | null;
  requestCount: number;
  series: {
    avgMs: PerformanceSparklinePoint[];
    p95Ms: PerformanceSparklinePoint[];
    apdexPct: PerformanceSparklinePoint[];
  };
};

export type PerformancePageSummary = {
  window: {
    since: string;
    until: string;
    label: string;
    compareLabel: string;
  };
  chartWindow: {
    since: string;
    until: string;
  };
  bucket: OverviewSeriesBucket;
  webVitals: {
    available: boolean;
    vitals: Record<PerformanceVitalKey, WebVitalMetricSummary>;
  };
  requestLatency: PerformanceRequestLatency;
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

/** Google Web Vitals bands — aligned with SDK `rateWebVital` thresholds. */
export const WEB_VITAL_THRESHOLDS: Record<
  PerformanceVitalKey,
  { goodMax: number; poorMin: number }
> = {
  LCP: { goodMax: 2500, poorMin: 4000 },
  INP: { goodMax: 200, poorMin: 500 },
  CLS: { goodMax: 0.1, poorMin: 0.25 },
  TTFB: { goodMax: 800, poorMin: 1800 },
};

/** Map raw `$web_vital` metric names into dashboard vital keys (FID → INP). */
export function normalizeWebVitalMetric(
  raw: string | null | undefined
): PerformanceVitalKey | null {
  const metric = raw?.trim().toUpperCase();
  if (metric === "FID" || metric === "INP") return "INP";
  if (metric === "LCP" || metric === "CLS" || metric === "TTFB") return metric;
  return null;
}

/** Numeric `value` from `$web_vital` event properties, or NULL when absent/invalid. */
export function webVitalValueExpr(alias = "e"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`CASE
    WHEN ${a}."properties"->>'value' ~ '^-?[0-9]+(\.[0-9]+)?$'
    THEN (${a}."properties"->>'value')::double precision
  END`;
}

/** Normalized vital key for SQL grouping (FID samples roll into INP). */
export function webVitalMetricKeySql(alias = "e"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`CASE
    WHEN UPPER(TRIM(COALESCE(${a}."properties"->>'metric', ''))) IN ('INP', 'FID') THEN 'INP'
    WHEN UPPER(TRIM(COALESCE(${a}."properties"->>'metric', ''))) = 'LCP' THEN 'LCP'
    WHEN UPPER(TRIM(COALESCE(${a}."properties"->>'metric', ''))) = 'CLS' THEN 'CLS'
    WHEN UPPER(TRIM(COALESCE(${a}."properties"->>'metric', ''))) = 'TTFB' THEN 'TTFB'
  END`;
}

/** Lowercase rating band derived from value and Google Web Vitals thresholds. */
export function webVitalComputedRatingSql(
  metricKeyExpr: Prisma.Sql,
  valueExpr: Prisma.Sql
): Prisma.Sql {
  return Prisma.sql`CASE
    WHEN ${metricKeyExpr} = 'LCP' AND ${valueExpr} <= ${WEB_VITAL_THRESHOLDS.LCP.goodMax} THEN 'good'
    WHEN ${metricKeyExpr} = 'LCP' AND ${valueExpr} >= ${WEB_VITAL_THRESHOLDS.LCP.poorMin} THEN 'poor'
    WHEN ${metricKeyExpr} = 'LCP' THEN 'needs-improvement'
    WHEN ${metricKeyExpr} = 'INP' AND ${valueExpr} <= ${WEB_VITAL_THRESHOLDS.INP.goodMax} THEN 'good'
    WHEN ${metricKeyExpr} = 'INP' AND ${valueExpr} >= ${WEB_VITAL_THRESHOLDS.INP.poorMin} THEN 'poor'
    WHEN ${metricKeyExpr} = 'INP' THEN 'needs-improvement'
    WHEN ${metricKeyExpr} = 'CLS' AND ${valueExpr} <= ${WEB_VITAL_THRESHOLDS.CLS.goodMax} THEN 'good'
    WHEN ${metricKeyExpr} = 'CLS' AND ${valueExpr} >= ${WEB_VITAL_THRESHOLDS.CLS.poorMin} THEN 'poor'
    WHEN ${metricKeyExpr} = 'CLS' THEN 'needs-improvement'
    WHEN ${metricKeyExpr} = 'TTFB' AND ${valueExpr} <= ${WEB_VITAL_THRESHOLDS.TTFB.goodMax} THEN 'good'
    WHEN ${metricKeyExpr} = 'TTFB' AND ${valueExpr} >= ${WEB_VITAL_THRESHOLDS.TTFB.poorMin} THEN 'poor'
    WHEN ${metricKeyExpr} = 'TTFB' THEN 'needs-improvement'
  END`;
}

export function parsePerformanceMetricsAnchor(value: string | undefined): Date {
  const raw = value?.trim();
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function resolvePerformanceSummaryWindow(
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

export function buildPerformanceFilter(input: {
  appId?: string;
  platform?: string;
  environment?: string;
  release?: string;
  range: { gte?: Date; lte?: Date };
}): PerformanceFilterInput {
  const filter: PerformanceFilterInput = { range: input.range };
  if (input.appId) filter.appId = input.appId;
  if (input.platform) filter.platform = input.platform;
  if (input.environment) filter.environment = input.environment;
  if (input.release) filter.release = input.release;
  return filter;
}

function performanceEventFilterSql(
  f: PerformanceFilterInput,
  projectId: string
): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`e."project_id" = ${projectId}`];
  if (f.appId) parts.push(Prisma.sql`e."app" = ${f.appId}`);
  if (f.environment) parts.push(Prisma.sql`e."environment" = ${f.environment}`);
  if (f.platform) parts.push(Prisma.sql`e."platform" = ${f.platform}`);
  if (f.release) parts.push(Prisma.sql`e."release" = ${f.release}`);
  return Prisma.join(parts, " AND ");
}

export function pctOfTotal(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

/** Build rating distribution counts and percentages from raw counts. */
export function buildWebVitalRatingDistribution(
  good: number,
  needsImprovement: number,
  poor: number
): WebVitalRatingDistribution {
  const total = good + needsImprovement + poor;
  return {
    good,
    needsImprovement,
    poor,
    total,
    goodPct: pctOfTotal(good, total),
    needsImprovementPct: pctOfTotal(needsImprovement, total),
    poorPct: pctOfTotal(poor, total),
  };
}

/** Round vital values for API output — CLS keeps fractional precision. */
export function roundWebVitalValue(
  metric: PerformanceVitalKey,
  value: number | null | undefined
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (metric === "CLS") return Math.round(value * 1000) / 1000;
  return Math.round(value);
}

export function mergeVitalSeriesBuckets(
  expectedBuckets: Date[],
  rows: { bucket: Date; p75: number | null; sampleCount: number }[],
  metric: PerformanceVitalKey
): PerformanceSparklinePoint[] {
  const byBucket = new Map(
    rows.map((row) => [
      row.bucket.toISOString(),
      {
        p75: roundWebVitalValue(metric, row.p75),
        sampleCount: row.sampleCount,
      },
    ])
  );
  return expectedBuckets.map((bucketDate) => {
    const t = bucketDate.toISOString();
    const row = byBucket.get(t);
    if (!row || row.sampleCount <= 0) return { t, value: null };
    return { t, value: row.p75 };
  });
}

function emptyVitalSummary(metric: PerformanceVitalKey): WebVitalMetricSummary {
  return {
    metric,
    sampleCount: 0,
    p75: null,
    p95: null,
    rating: buildWebVitalRatingDistribution(0, 0, 0),
    series: [],
  };
}

type VitalScalarRow = {
  metric: string;
  sample_count: bigint;
  p75: number | null;
  p95: number | null;
  good_count: bigint;
  needs_improvement_count: bigint;
  poor_count: bigint;
};

type VitalBucketRow = {
  bucket: Date;
  metric: string;
  p75: number | null;
  sample_count: bigint;
};

async function fetchWebVitalScalars(
  prisma: PrismaClient,
  f: PerformanceFilterInput,
  projectId: string,
  since: Date,
  until: Date
): Promise<VitalScalarRow[]> {
  const filters = performanceEventFilterSql(f, projectId);
  const value = webVitalValueExpr("e");
  const metricKey = webVitalMetricKeySql("e");
  const rating = webVitalComputedRatingSql(metricKey, value);

  return prisma.$queryRaw<VitalScalarRow[]>(Prisma.sql`
    SELECT
      ${metricKey} AS metric,
      COUNT(*)::bigint AS sample_count,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${value}) AS p75,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${value}) AS p95,
      COUNT(*) FILTER (WHERE ${rating} = 'good')::bigint AS good_count,
      COUNT(*) FILTER (WHERE ${rating} = 'needs-improvement')::bigint AS needs_improvement_count,
      COUNT(*) FILTER (WHERE ${rating} = 'poor')::bigint AS poor_count
    FROM "Event" e
    WHERE ${filters}
      AND e."name" = ${WEB_VITAL_EVENT_NAME}
      AND ${metricKey} IS NOT NULL
      AND ${value} IS NOT NULL
      AND e."created_at" >= ${since}
      AND e."created_at" <= ${until}
    GROUP BY 1
  `);
}

async function fetchWebVitalSeries(
  prisma: PrismaClient,
  f: PerformanceFilterInput,
  projectId: string,
  chartSince: Date,
  until: Date,
  bucket: OverviewSeriesBucket
): Promise<VitalBucketRow[]> {
  const filters = performanceEventFilterSql(f, projectId);
  const value = webVitalValueExpr("e");
  const metricKey = webVitalMetricKeySql("e");
  const trunc = bucket === "week" ? "week" : bucket;

  return prisma.$queryRaw<VitalBucketRow[]>(Prisma.sql`
    SELECT
      (date_trunc(${trunc}, e."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      ${metricKey} AS metric,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${value}) AS p75,
      COUNT(*)::bigint AS sample_count
    FROM "Event" e
    WHERE ${filters}
      AND e."name" = ${WEB_VITAL_EVENT_NAME}
      AND ${metricKey} IS NOT NULL
      AND ${value} IS NOT NULL
      AND e."created_at" >= ${chartSince}
      AND e."created_at" <= ${until}
    GROUP BY 1, 2
    ORDER BY 1
  `);
}

function buildVitalSummaries(
  scalarRows: VitalScalarRow[],
  bucketRows: VitalBucketRow[],
  chartSince: Date,
  until: Date,
  bucket: OverviewSeriesBucket
): Record<PerformanceVitalKey, WebVitalMetricSummary> {
  const buckets = generateOverviewChartBuckets(chartSince, until, bucket);
  const seriesByMetric = new Map<PerformanceVitalKey, VitalBucketRow[]>();
  for (const key of PERFORMANCE_VITAL_KEYS) seriesByMetric.set(key, []);
  for (const row of bucketRows) {
    const key = normalizeWebVitalMetric(row.metric);
    if (!key) continue;
    seriesByMetric.get(key)?.push(row);
  }

  const scalarByMetric = new Map<PerformanceVitalKey, VitalScalarRow>();
  for (const row of scalarRows) {
    const key = normalizeWebVitalMetric(row.metric);
    if (!key) continue;
    const existing = scalarByMetric.get(key);
    if (!existing) {
      scalarByMetric.set(key, row);
      continue;
    }
    scalarByMetric.set(key, {
      metric: key,
      sample_count: BigInt(Number(existing.sample_count) + Number(row.sample_count)),
      p75: existing.p75,
      p95: existing.p95,
      good_count: BigInt(Number(existing.good_count) + Number(row.good_count)),
      needs_improvement_count: BigInt(
        Number(existing.needs_improvement_count) + Number(row.needs_improvement_count)
      ),
      poor_count: BigInt(Number(existing.poor_count) + Number(row.poor_count)),
    });
  }

  const result = {} as Record<PerformanceVitalKey, WebVitalMetricSummary>;
  for (const key of PERFORMANCE_VITAL_KEYS) {
    const scalar = scalarByMetric.get(key);
    if (!scalar || Number(scalar.sample_count) === 0) {
      const empty = emptyVitalSummary(key);
      empty.series = mergeVitalSeriesBuckets(buckets, [], key);
      result[key] = empty;
      continue;
    }
    const seriesRows = (seriesByMetric.get(key) ?? []).map((row) => ({
      bucket: row.bucket,
      p75: row.p75,
      sampleCount: Number(row.sample_count),
    }));
    result[key] = {
      metric: key,
      sampleCount: Number(scalar.sample_count),
      p75: roundWebVitalValue(key, scalar.p75),
      p95: roundWebVitalValue(key, scalar.p95),
      rating: buildWebVitalRatingDistribution(
        Number(scalar.good_count),
        Number(scalar.needs_improvement_count),
        Number(scalar.poor_count)
      ),
      series: mergeVitalSeriesBuckets(buckets, seriesRows, key),
    };
  }
  return result;
}

type RequestScalarRow = {
  avg_response_ms: number | null;
  avg_response_ms_previous: number | null;
  p95_response_ms: number | null;
  p95_response_ms_previous: number | null;
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
  p95_response_ms: number | null;
  satisfied: bigint;
  tolerating: bigint;
  total: bigint;
};

async function fetchPerformanceRequestLatency(
  prisma: PrismaClient,
  f: PerformanceFilterInput,
  projectId: string,
  window: ResolvedSummaryWindow,
  bucket: OverviewSeriesBucket,
  thresholdMs = REQUEST_APDEX_THRESHOLD_MS
): Promise<PerformanceRequestLatency> {
  const { since, until, previousSince, previousUntil } = window;
  const scope: PerformanceFilterInput = f;
  const filters = performanceEventFilterSql(scope, projectId);
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
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${duration})
          FILTER (WHERE ${currentWindow}) AS p95_response_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${duration})
          FILTER (WHERE ${previousWindow}) AS p95_response_ms_previous,
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
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${duration}) AS p95_response_ms,
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
  const previousRequestCount = Number(row?.total_previous ?? 0);

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

  const mapSeries = (
    pick: (bucketRow: RequestBucketRow | undefined, total: number) => number | null
  ): PerformanceSparklinePoint[] =>
    buckets.map((bucketDate) => {
      const t = bucketDate.toISOString();
      const bucketRow = byBucket.get(t);
      const total = Number(bucketRow?.total ?? 0);
      return { t, value: pick(bucketRow, total) };
    });

  return {
    available: true,
    avgMs: Math.round(Number(row?.avg_response_ms ?? 0)),
    avgMsPrevious: avgResponseMsForBucket(
      row?.avg_response_ms_previous,
      previousRequestCount
    ),
    p95Ms: Math.round(Number(row?.p95_response_ms ?? 0)),
    p95MsPrevious:
      previousRequestCount <= 0 || row?.p95_response_ms_previous == null
        ? null
        : Math.round(Number(row.p95_response_ms_previous)),
    apdex,
    apdexPct: apdexPctFromScore(apdex),
    apdexPrevious,
    requestCount,
    series: {
      avgMs: mapSeries((bucketRow, total) =>
        avgResponseMsForBucket(bucketRow?.avg_response_ms, total)
      ),
      p95Ms: mapSeries((bucketRow, total) => {
        if (total <= 0 || bucketRow?.p95_response_ms == null) return null;
        return Math.round(Number(bucketRow.p95_response_ms));
      }),
      apdexPct: mapSeries((bucketRow, total) => {
        if (total <= 0) return null;
        return apdexPctFromScore(
          apdexScore(
            Number(bucketRow?.satisfied ?? 0),
            Number(bucketRow?.tolerating ?? 0),
            total
          )
        );
      }),
    },
  };
}

export async function fetchPerformancePageSummary(
  prisma: PrismaClient,
  f: PerformanceFilterInput,
  projectId: string,
  window: ResolvedSummaryWindow,
  chartBucket?: OverviewSeriesBucket
): Promise<PerformancePageSummary> {
  const { since, until } = window;
  const durationMs = Math.max(until.getTime() - since.getTime(), 1);
  const bucket = chartBucket ?? chooseTimeRangeBucket(durationMs).bucket;
  const chartSince = overviewChartQuerySince(since, until, bucket);

  const [scalarRows, bucketRows, requestLatency] = await Promise.all([
    fetchWebVitalScalars(prisma, f, projectId, since, until),
    fetchWebVitalSeries(prisma, f, projectId, chartSince, until, bucket),
    fetchPerformanceRequestLatency(prisma, f, projectId, window, bucket),
  ]);

  const vitals = buildVitalSummaries(
    scalarRows,
    bucketRows,
    chartSince,
    until,
    bucket
  );
  const webVitalsAvailable = PERFORMANCE_VITAL_KEYS.some(
    (key) => vitals[key].sampleCount > 0
  );

  return {
    window: {
      since: since.toISOString(),
      until: until.toISOString(),
      label: window.label,
      compareLabel: window.compareLabel,
    },
    chartWindow: {
      since: chartSince.toISOString(),
      until: until.toISOString(),
    },
    bucket,
    webVitals: {
      available: webVitalsAvailable,
      vitals,
    },
    requestLatency,
  };
}
