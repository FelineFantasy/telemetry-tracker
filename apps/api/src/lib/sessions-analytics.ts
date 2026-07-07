/**
 * Sessions page analytics: volume series and platform breakdown.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import {
  eventPlatformCategorySql,
  mergePlatformBreakdown,
  type EventPlatformCategory,
} from "./events-analytics.js";
import {
  generateOverviewChartBuckets,
  overviewChartQuerySince,
  type OverviewSeriesBucket,
} from "./overview-timeseries.js";
import type { ResolvedSummaryWindow, SessionListFilterInput } from "./sessions-page-summary.js";
import { sessionFilterSql } from "./sessions-page-summary.js";
import { parseChartBucketParam, resolveChartBucket, type TimeRangeBucket } from "./time-range.js";

export type SessionsVolumePoint = {
  t: string;
  count: number;
};

export type SessionsPlatformSlice = {
  platform: EventPlatformCategory;
  count: number;
  sharePct: number;
};

export type SessionsAnalytics = {
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
  volume: SessionsVolumePoint[];
  platforms: SessionsPlatformSlice[];
};

type BucketRow = {
  bucket: Date;
  c: bigint;
};

function buildSessionAnalyticsFilterSql(
  f: SessionListFilterInput,
  projectId: string,
  eventWindow: { gte: Date; lte: Date }
): Prisma.Sql {
  return sessionFilterSql(projectId, f, eventWindow);
}

/** Zero-fill bucket rows into a continuous volume series. */
export function mergeSessionsVolumeBuckets(
  expectedBuckets: Date[],
  rows: { bucket: Date; count: number }[]
): SessionsVolumePoint[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.bucket.toISOString(), row.count);
  }
  return expectedBuckets.map((d) => ({
    t: d.toISOString(),
    count: map.get(d.toISOString()) ?? 0,
  }));
}

export { parseChartBucketParam };

export async function fetchSessionsAnalytics(
  prisma: PrismaClient,
  f: SessionListFilterInput,
  projectId: string,
  window: ResolvedSummaryWindow,
  bucketOverride?: TimeRangeBucket
): Promise<SessionsAnalytics> {
  const { since, until } = window;
  const durationMs = Math.max(until.getTime() - since.getTime(), 1);
  const bucket = resolveChartBucket(durationMs, bucketOverride);
  const expectedBuckets = generateOverviewChartBuckets(since, until, bucket);
  const chartSince = expectedBuckets[0] ?? since;
  const querySince = overviewChartQuerySince(since, until, bucket);

  const sessionFilterVolume = buildSessionAnalyticsFilterSql(f, projectId, {
    gte: querySince,
    lte: until,
  });
  const sessionFilterPlatforms = buildSessionAnalyticsFilterSql(f, projectId, {
    gte: since,
    lte: until,
  });
  const platformExpr = eventPlatformCategorySql("s");
  const trunc = bucket === "week" ? "week" : bucket;

  const [bucketRows, platformRows] = await Promise.all([
    prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      SELECT
        (date_trunc(${trunc}, s."started_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
        COUNT(*)::bigint AS c
      FROM "Session" s
      WHERE ${sessionFilterVolume}
        AND s."started_at" >= ${querySince}
        AND s."started_at" <= ${until}
      GROUP BY 1
      ORDER BY 1
    `),
    prisma.$queryRaw<{ platform: string; c: bigint }[]>(Prisma.sql`
      SELECT
        ${platformExpr} AS platform,
        COUNT(*)::bigint AS c
      FROM "Session" s
      WHERE ${sessionFilterPlatforms}
        AND s."started_at" >= ${since}
        AND s."started_at" <= ${until}
      GROUP BY 1
      ORDER BY 2 DESC
    `),
  ]);

  const volume = mergeSessionsVolumeBuckets(
    expectedBuckets,
    bucketRows.map((row) => ({
      bucket: row.bucket,
      count: Number(row.c),
    }))
  );

  const platforms = mergePlatformBreakdown(
    platformRows.map((row) => ({
      platform: String(row.platform),
      count: Number(row.c),
    }))
  ) as SessionsPlatformSlice[];

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
    volume,
    platforms,
  };
}
