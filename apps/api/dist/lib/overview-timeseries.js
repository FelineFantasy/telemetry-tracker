/**
 * Overview volume series: PostgreSQL buckets in UTC, merged with zero-filled keys
 * so charts show continuous lines (no misleading gaps).
 */
import { Prisma } from "@prisma/client";
/** Truncate to UTC hour start (aligned with date_trunc hour in UTC). */
function truncateUtcHour(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), 0, 0, 0));
}
/** Truncate to UTC midnight. */
function truncateUtcDay(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
function generateUtcHourBuckets(since, n) {
    const start = truncateUtcHour(since);
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push(new Date(start.getTime() + i * 60 * 60 * 1000));
    }
    return out;
}
function generateUtcDayBuckets(since, n) {
    const start = truncateUtcDay(since);
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push(new Date(start.getTime() + i * 86_400_000));
    }
    return out;
}
function bucketKeyUtc(d) {
    return d.toISOString();
}
function mergeBuckets(expected, rows) {
    const map = new Map();
    for (const row of rows) {
        const k = row.bucket.toISOString();
        map.set(k, Number(row.c));
    }
    return expected.map((d) => ({
        t: bucketKeyUtc(d),
        count: map.get(bucketKeyUtc(d)) ?? 0,
    }));
}
async function queryEventBucketsHourly(prisma, since, appFilter) {
    if (appFilter) {
        return prisma.$queryRaw(Prisma.sql `
      SELECT
        (date_trunc('hour', e."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
        COUNT(*)::bigint AS c
      FROM "Event" e
      WHERE e."created_at" >= ${since}
        AND e."app" = ${appFilter}
      GROUP BY 1
      ORDER BY 1
    `);
    }
    return prisma.$queryRaw(Prisma.sql `
    SELECT
      (date_trunc('hour', e."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      COUNT(*)::bigint AS c
    FROM "Event" e
    WHERE e."created_at" >= ${since}
    GROUP BY 1
    ORDER BY 1
  `);
}
async function queryEventBucketsDaily(prisma, since, appFilter) {
    if (appFilter) {
        return prisma.$queryRaw(Prisma.sql `
      SELECT
        (date_trunc('day', e."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
        COUNT(*)::bigint AS c
      FROM "Event" e
      WHERE e."created_at" >= ${since}
        AND e."app" = ${appFilter}
      GROUP BY 1
      ORDER BY 1
    `);
    }
    return prisma.$queryRaw(Prisma.sql `
    SELECT
      (date_trunc('day', e."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      COUNT(*)::bigint AS c
    FROM "Event" e
    WHERE e."created_at" >= ${since}
    GROUP BY 1
    ORDER BY 1
  `);
}
async function queryErrorBucketsHourly(prisma, since, appFilter) {
    if (appFilter) {
        return prisma.$queryRaw(Prisma.sql `
      SELECT
        (date_trunc('hour', eo."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
        COUNT(*)::bigint AS c
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eo."error_group_id" = eg.id
      WHERE eo."created_at" >= ${since}
        AND eg."app" = ${appFilter}
      GROUP BY 1
      ORDER BY 1
    `);
    }
    return prisma.$queryRaw(Prisma.sql `
    SELECT
      (date_trunc('hour', eo."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      COUNT(*)::bigint AS c
    FROM "ErrorOccurrence" eo
    WHERE eo."created_at" >= ${since}
    GROUP BY 1
    ORDER BY 1
  `);
}
async function queryErrorBucketsDaily(prisma, since, appFilter) {
    if (appFilter) {
        return prisma.$queryRaw(Prisma.sql `
      SELECT
        (date_trunc('day', eo."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
        COUNT(*)::bigint AS c
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eo."error_group_id" = eg.id
      WHERE eo."created_at" >= ${since}
        AND eg."app" = ${appFilter}
      GROUP BY 1
      ORDER BY 1
    `);
    }
    return prisma.$queryRaw(Prisma.sql `
    SELECT
      (date_trunc('day', eo."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
      COUNT(*)::bigint AS c
    FROM "ErrorOccurrence" eo
    WHERE eo."created_at" >= ${since}
    GROUP BY 1
    ORDER BY 1
  `);
}
/**
 * Load error + event counts per UTC bucket for the overview range.
 * `rangeLabel` is "24h" → 24 hourly points; "7d" → 7 daily points.
 */
export async function getOverviewTimeSeries(prisma, rangeLabel, since, appFilter) {
    const is7d = rangeLabel === "7d";
    const bucket = is7d ? "day" : "hour";
    const expected = is7d ? generateUtcDayBuckets(since, 7) : generateUtcHourBuckets(since, 24);
    const [eventRows, errorRows] = is7d
        ? await Promise.all([
            queryEventBucketsDaily(prisma, since, appFilter),
            queryErrorBucketsDaily(prisma, since, appFilter),
        ])
        : await Promise.all([
            queryEventBucketsHourly(prisma, since, appFilter),
            queryErrorBucketsHourly(prisma, since, appFilter),
        ]);
    return {
        bucket,
        events: mergeBuckets(expected, eventRows),
        errors: mergeBuckets(expected, errorRows),
    };
}
