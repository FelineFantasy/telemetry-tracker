/**
 * Overview volume series: PostgreSQL buckets in UTC, merged with zero-filled keys
 * so charts show continuous lines (no misleading gaps).
 */
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export type OverviewSeriesBucket = "hour" | "day" | "week";

/** Max chart buckets — wide windows anchor on `until` so recent data stays visible. */
export const OVERVIEW_CHART_MAX_BUCKETS = 120;

export type OverviewTimeSeriesPoint = {
  t: string;
  count: number;
};

export type OverviewTimeSeries = {
  bucket: OverviewSeriesBucket;
  errors: OverviewTimeSeriesPoint[];
  events: OverviewTimeSeriesPoint[];
};

/** Truncate to UTC hour start (aligned with date_trunc hour in UTC). */
function truncateUtcHour(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      0,
      0,
      0
    )
  );
}

/** Truncate to UTC midnight. */
function truncateUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)
  );
}

function truncateUtcWeek(d: Date): Date {
  const day = truncateUtcDay(d);
  const dow = day.getUTCDay();
  const diff = dow === 0 ? 6 : dow - 1;
  return new Date(day.getTime() - diff * 86_400_000);
}

function bucketStepMs(bucket: OverviewSeriesBucket): number {
  if (bucket === "hour") return 60 * 60 * 1000;
  if (bucket === "day") return 86_400_000;
  return 7 * 86_400_000;
}

function truncateForBucket(d: Date, bucket: OverviewSeriesBucket): Date {
  if (bucket === "hour") return truncateUtcHour(d);
  if (bucket === "day") return truncateUtcDay(d);
  return truncateUtcWeek(d);
}

/** @internal Exported for unit tests. */
export function generateOverviewChartBuckets(
  since: Date,
  until: Date,
  bucket: OverviewSeriesBucket
): Date[] {
  return generateBuckets(since, until, bucket);
}

/** Lower bound for chart SQL — first rendered bucket (capped at 120). */
export function overviewChartQuerySince(
  since: Date,
  until: Date,
  bucket: OverviewSeriesBucket
): Date {
  const expected = generateBuckets(since, until, bucket);
  return expected[0] ?? truncateForBucket(since, bucket);
}

function generateBuckets(since: Date, until: Date, bucket: OverviewSeriesBucket): Date[] {
  const step = bucketStepMs(bucket);
  const start = truncateForBucket(since, bucket);
  const end = truncateForBucket(until, bucket);
  const spanBuckets = Math.floor((end.getTime() - start.getTime()) / step) + 1;

  if (spanBuckets <= OVERVIEW_CHART_MAX_BUCKETS) {
    const out: Date[] = [];
    for (let t = start.getTime(); t <= end.getTime(); t += step) {
      out.push(new Date(t));
    }
    if (out.length === 0) out.push(start);
    return out;
  }

  const windowStart = end.getTime() - (OVERVIEW_CHART_MAX_BUCKETS - 1) * step;
  const out: Date[] = [];
  for (let t = windowStart; t <= end.getTime(); t += step) {
    out.push(new Date(t));
  }
  return out;
}

function bucketKeyUtc(d: Date): string {
  return d.toISOString();
}

function mergeBuckets(
  expected: Date[],
  rows: { bucket: Date; c: bigint }[]
): OverviewTimeSeriesPoint[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = row.bucket.toISOString();
    map.set(k, Number(row.c));
  }
  return expected.map((d) => ({
    t: bucketKeyUtc(d),
    count: map.get(bucketKeyUtc(d)) ?? 0,
  }));
}

async function queryEventBuckets(
  prisma: PrismaClient,
  bucket: OverviewSeriesBucket,
  projectId: string,
  since: Date,
  until: Date,
  appFilter: string | undefined,
  environmentFilter: string | undefined
): Promise<{ bucket: Date; c: bigint }[]> {
  const envClause = environmentFilter
    ? Prisma.sql`AND e."environment" = ${environmentFilter}`
    : Prisma.empty;
  const appClause = appFilter ? Prisma.sql`AND e."app" = ${appFilter}` : Prisma.empty;
  return prisma.$queryRaw<{ bucket: Date; c: bigint }[]>(Prisma.sql`
    SELECT
      (date_trunc(${bucket}, e."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      COUNT(*)::bigint AS c
    FROM "Event" e
    WHERE e."project_id" = ${projectId}
      AND e."created_at" >= ${since}
      AND e."created_at" <= ${until}
      ${appClause}
      ${envClause}
    GROUP BY 1
    ORDER BY 1
  `);
}

async function queryErrorBuckets(
  prisma: PrismaClient,
  bucket: OverviewSeriesBucket,
  projectId: string,
  since: Date,
  until: Date,
  appFilter: string | undefined,
  environmentFilter: string | undefined
): Promise<{ bucket: Date; c: bigint }[]> {
  const envClause = environmentFilter
    ? Prisma.sql`AND eg."environment" = ${environmentFilter}`
    : Prisma.empty;
  const appClause = appFilter ? Prisma.sql`AND eg."app" = ${appFilter}` : Prisma.empty;
  return prisma.$queryRaw<{ bucket: Date; c: bigint }[]>(Prisma.sql`
    SELECT
      (date_trunc(${bucket}, eo."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      COUNT(*)::bigint AS c
    FROM "ErrorOccurrence" eo
    INNER JOIN "ErrorGroup" eg ON eo."error_group_id" = eg.id
    WHERE eg."project_id" = ${projectId}
      AND eo."created_at" >= ${since}
      AND eo."created_at" <= ${until}
      ${appClause}
      ${envClause}
    GROUP BY 1
    ORDER BY 1
  `);
}

/**
 * Load error + event counts per UTC bucket for the overview window.
 */
export async function getOverviewTimeSeries(
  prisma: PrismaClient,
  projectId: string,
  since: Date,
  until: Date,
  bucket: OverviewSeriesBucket,
  appFilter: string | undefined,
  environmentFilter?: string
): Promise<OverviewTimeSeries> {
  const expected = generateBuckets(since, until, bucket);
  const querySince = overviewChartQuerySince(since, until, bucket);

  const [eventRows, errorRows] = await Promise.all([
    queryEventBuckets(
      prisma,
      bucket,
      projectId,
      querySince,
      until,
      appFilter,
      environmentFilter
    ),
    queryErrorBuckets(
      prisma,
      bucket,
      projectId,
      querySince,
      until,
      appFilter,
      environmentFilter
    ),
  ]);

  return {
    bucket,
    events: mergeBuckets(expected, eventRows),
    errors: mergeBuckets(expected, errorRows),
  };
}
