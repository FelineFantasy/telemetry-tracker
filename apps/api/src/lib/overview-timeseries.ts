/**
 * Overview volume series: PostgreSQL buckets in UTC, merged with zero-filled keys
 * so charts show continuous lines (no misleading gaps).
 */
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export type OverviewSeriesBucket = "hour" | "day";

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

function generateUtcHourBuckets(since: Date, n: number): Date[] {
  const start = truncateUtcHour(since);
  const out: Date[] = [];
  for (let i = 0; i < n; i++) {
    out.push(new Date(start.getTime() + i * 60 * 60 * 1000));
  }
  return out;
}

function generateUtcDayBuckets(since: Date, n: number): Date[] {
  const start = truncateUtcDay(since);
  const out: Date[] = [];
  for (let i = 0; i < n; i++) {
    out.push(new Date(start.getTime() + i * 86_400_000));
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

async function queryEventBucketsHourly(
  prisma: PrismaClient,
  projectId: string,
  since: Date,
  appFilter: string | undefined,
  environmentFilter: string | undefined
): Promise<{ bucket: Date; c: bigint }[]> {
  const envClause = environmentFilter
    ? Prisma.sql`AND e."environment" = ${environmentFilter}`
    : Prisma.empty;
  if (appFilter) {
    return prisma.$queryRaw<{ bucket: Date; c: bigint }[]>(Prisma.sql`
      SELECT
        (date_trunc('hour', e."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
        COUNT(*)::bigint AS c
      FROM "Event" e
      WHERE e."project_id" = ${projectId}
        AND e."created_at" >= ${since}
        AND e."app" = ${appFilter}
        ${envClause}
      GROUP BY 1
      ORDER BY 1
    `);
  }
  return prisma.$queryRaw<{ bucket: Date; c: bigint }[]>(Prisma.sql`
    SELECT
      (date_trunc('hour', e."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      COUNT(*)::bigint AS c
    FROM "Event" e
    WHERE e."project_id" = ${projectId}
      AND e."created_at" >= ${since}
      ${envClause}
    GROUP BY 1
    ORDER BY 1
  `);
}

async function queryEventBucketsDaily(
  prisma: PrismaClient,
  projectId: string,
  since: Date,
  appFilter: string | undefined,
  environmentFilter: string | undefined
): Promise<{ bucket: Date; c: bigint }[]> {
  const envClause = environmentFilter
    ? Prisma.sql`AND e."environment" = ${environmentFilter}`
    : Prisma.empty;
  if (appFilter) {
    return prisma.$queryRaw<{ bucket: Date; c: bigint }[]>(Prisma.sql`
      SELECT
        (date_trunc('day', e."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
        COUNT(*)::bigint AS c
      FROM "Event" e
      WHERE e."project_id" = ${projectId}
        AND e."created_at" >= ${since}
        AND e."app" = ${appFilter}
        ${envClause}
      GROUP BY 1
      ORDER BY 1
    `);
  }
  return prisma.$queryRaw<{ bucket: Date; c: bigint }[]>(Prisma.sql`
    SELECT
      (date_trunc('day', e."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      COUNT(*)::bigint AS c
    FROM "Event" e
    WHERE e."project_id" = ${projectId}
      AND e."created_at" >= ${since}
      ${envClause}
    GROUP BY 1
    ORDER BY 1
  `);
}

async function queryErrorBucketsHourly(
  prisma: PrismaClient,
  projectId: string,
  since: Date,
  appFilter: string | undefined,
  environmentFilter: string | undefined
): Promise<{ bucket: Date; c: bigint }[]> {
  const envClause = environmentFilter
    ? Prisma.sql`AND eg."environment" = ${environmentFilter}`
    : Prisma.empty;
  if (appFilter) {
    return prisma.$queryRaw<{ bucket: Date; c: bigint }[]>(Prisma.sql`
      SELECT
        (date_trunc('hour', eo."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
        COUNT(*)::bigint AS c
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eo."error_group_id" = eg.id
      WHERE eg."project_id" = ${projectId}
        AND eo."created_at" >= ${since}
        AND eg."app" = ${appFilter}
        ${envClause}
      GROUP BY 1
      ORDER BY 1
    `);
  }
  return prisma.$queryRaw<{ bucket: Date; c: bigint }[]>(Prisma.sql`
    SELECT
      (date_trunc('hour', eo."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      COUNT(*)::bigint AS c
    FROM "ErrorOccurrence" eo
    INNER JOIN "ErrorGroup" eg ON eo."error_group_id" = eg.id
    WHERE eg."project_id" = ${projectId}
      AND eo."created_at" >= ${since}
      ${envClause}
    GROUP BY 1
    ORDER BY 1
  `);
}

async function queryErrorBucketsDaily(
  prisma: PrismaClient,
  projectId: string,
  since: Date,
  appFilter: string | undefined,
  environmentFilter: string | undefined
): Promise<{ bucket: Date; c: bigint }[]> {
  const envClause = environmentFilter
    ? Prisma.sql`AND eg."environment" = ${environmentFilter}`
    : Prisma.empty;
  if (appFilter) {
    return prisma.$queryRaw<{ bucket: Date; c: bigint }[]>(Prisma.sql`
      SELECT
        (date_trunc('day', eo."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
        COUNT(*)::bigint AS c
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eo."error_group_id" = eg.id
      WHERE eg."project_id" = ${projectId}
        AND eo."created_at" >= ${since}
        AND eg."app" = ${appFilter}
        ${envClause}
      GROUP BY 1
      ORDER BY 1
    `);
  }
  return prisma.$queryRaw<{ bucket: Date; c: bigint }[]>(Prisma.sql`
    SELECT
      (date_trunc('day', eo."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      COUNT(*)::bigint AS c
    FROM "ErrorOccurrence" eo
    INNER JOIN "ErrorGroup" eg ON eo."error_group_id" = eg.id
    WHERE eg."project_id" = ${projectId}
      AND eo."created_at" >= ${since}
      ${envClause}
    GROUP BY 1
    ORDER BY 1
  `);
}

/**
 * Load error + event counts per UTC bucket for the overview range.
 * `rangeLabel` is "24h" → 24 hourly points; "7d" → 7 daily points.
 */
export async function getOverviewTimeSeries(
  prisma: PrismaClient,
  projectId: string,
  rangeLabel: "24h" | "7d",
  since: Date,
  appFilter: string | undefined,
  environmentFilter?: string
): Promise<OverviewTimeSeries> {
  const is7d = rangeLabel === "7d";
  const bucket: OverviewSeriesBucket = is7d ? "day" : "hour";
  const expected = is7d ? generateUtcDayBuckets(since, 7) : generateUtcHourBuckets(since, 24);

  const [eventRows, errorRows] = is7d
    ? await Promise.all([
        queryEventBucketsDaily(prisma, projectId, since, appFilter, environmentFilter),
        queryErrorBucketsDaily(prisma, projectId, since, appFilter, environmentFilter),
      ])
    : await Promise.all([
        queryEventBucketsHourly(prisma, projectId, since, appFilter, environmentFilter),
        queryErrorBucketsHourly(prisma, projectId, since, appFilter, environmentFilter),
      ]);

  return {
    bucket,
    events: mergeBuckets(expected, eventRows),
    errors: mergeBuckets(expected, errorRows),
  };
}
