/**
 * Events page analytics: volume series, top event names, and platform breakdown.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { escapeLikePattern } from "./list-query.js";
import type { EventListFilterInput } from "./events-list-query.js";
import type { ResolvedSummaryWindow } from "./events-page-summary.js";
import {
  generateOverviewChartBuckets,
  overviewChartQuerySince,
  type OverviewSeriesBucket,
} from "./overview-timeseries.js";
import { releaseFilterMatchSql } from "./release-key.js";
import { chooseTimeRangeBucket } from "./time-range.js";

export const EVENTS_TOP_EVENTS_LIMIT = 5;

export const EVENT_PLATFORM_CATEGORIES = ["Web", "iOS", "Android", "Other"] as const;

export type EventPlatformCategory = (typeof EVENT_PLATFORM_CATEGORIES)[number];

export type EventsVolumePoint = {
  t: string;
  count: number;
};

export type EventsTopEventRow = {
  name: string;
  count: number;
  sharePct: number;
};

export type EventsPlatformSlice = {
  platform: EventPlatformCategory;
  count: number;
  sharePct: number;
};

export type EventsAnalytics = {
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
  volume: EventsVolumePoint[];
  topEvents: EventsTopEventRow[];
  platforms: EventsPlatformSlice[];
};

type BucketRow = {
  bucket: Date;
  c: bigint;
};

/** Normalize raw platform strings into dashboard categories (Web / iOS / Android / Other). */
export function normalizeEventPlatform(value: string | null | undefined): EventPlatformCategory {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "web" || raw === "browser") return "Web";
  if (raw === "ios" || raw === "iphone" || raw === "ipad" || raw === "apple") return "iOS";
  if (raw === "android") return "Android";
  return "Other";
}

export function eventPlatformCategorySql(alias = "e"): Prisma.Sql {
  const col = Prisma.raw(`"${alias}"."platform"`);
  return Prisma.sql`CASE
    WHEN LOWER(TRIM(COALESCE(${col}::text, ''))) IN ('web', 'browser') THEN 'Web'
    WHEN LOWER(TRIM(COALESCE(${col}::text, ''))) IN ('ios', 'iphone', 'ipad', 'apple') THEN 'iOS'
    WHEN LOWER(TRIM(COALESCE(${col}::text, ''))) IN ('android') THEN 'Android'
    ELSE 'Other'
  END`;
}

function buildEventAnalyticsFilterSql(f: EventListFilterInput, projectId: string): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`e."project_id" = ${projectId}`];
  if (f.appId) parts.push(Prisma.sql`e."app" = ${f.appId}`);
  if (f.name) parts.push(Prisma.sql`e."name" = ${f.name}`);
  if (f.environment) parts.push(Prisma.sql`e."environment" = ${f.environment}`);
  if (f.platform) parts.push(Prisma.sql`e."platform" = ${f.platform}`);
  if (f.release) parts.push(releaseFilterMatchSql(Prisma.sql`e."release"`, f.release));
  if (f.propertiesContains?.trim()) {
    const pat = `%${escapeLikePattern(f.propertiesContains.trim())}%`;
    parts.push(Prisma.sql`e."properties"::text ILIKE ${pat} ESCAPE '\\'`);
  }
  return Prisma.join(parts, " AND ");
}

/** Zero-fill bucket rows into a continuous volume series. */
export function mergeEventsVolumeBuckets(
  expectedBuckets: Date[],
  rows: { bucket: Date; count: number }[]
): EventsVolumePoint[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.bucket.toISOString(), row.count);
  }
  return expectedBuckets.map((d) => ({
    t: d.toISOString(),
    count: map.get(d.toISOString()) ?? 0,
  }));
}

/** Rank event names by count and attach share percentages against the full window total. */
export function buildTopEvents(
  rows: { name: string; count: number }[],
  grandTotal: number,
  limit = EVENTS_TOP_EVENTS_LIMIT
): EventsTopEventRow[] {
  return [...rows]
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((row) => ({
      name: row.name,
      count: row.count,
      sharePct: grandTotal > 0 ? (row.count / grandTotal) * 100 : 0,
    }));
}

function isEventPlatformCategory(value: string): value is EventPlatformCategory {
  return (EVENT_PLATFORM_CATEGORIES as readonly string[]).includes(value);
}

/** Merge raw platform counts into fixed category slices with share percentages. */
export function mergePlatformBreakdown(
  rows: { platform: string; count: number }[]
): EventsPlatformSlice[] {
  const totals = new Map<EventPlatformCategory, number>();
  for (const category of EVENT_PLATFORM_CATEGORIES) totals.set(category, 0);

  for (const row of rows) {
    const category = isEventPlatformCategory(row.platform)
      ? row.platform
      : normalizeEventPlatform(row.platform);
    totals.set(category, (totals.get(category) ?? 0) + row.count);
  }

  const grandTotal = [...totals.values()].reduce((sum, count) => sum + count, 0);
  return EVENT_PLATFORM_CATEGORIES.map((platform) => {
    const count = totals.get(platform) ?? 0;
    return {
      platform,
      count,
      sharePct: grandTotal > 0 ? (count / grandTotal) * 100 : 0,
    };
  }).filter((slice) => slice.count > 0);
}

export async function fetchEventsAnalytics(
  prisma: PrismaClient,
  f: EventListFilterInput,
  projectId: string,
  window: ResolvedSummaryWindow
): Promise<EventsAnalytics> {
  const { since, until } = window;
  const durationMs = Math.max(until.getTime() - since.getTime(), 1);
  const { bucket } = chooseTimeRangeBucket(durationMs);
  const expectedBuckets = generateOverviewChartBuckets(since, until, bucket);
  const chartSince = expectedBuckets[0] ?? since;
  const querySince = overviewChartQuerySince(since, until, bucket);

  const eventFilter = buildEventAnalyticsFilterSql(f, projectId);
  const platformExpr = eventPlatformCategorySql("e");

  const [bucketRows, topRows, platformRows, totalRows] = await Promise.all([
    prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      SELECT
        (date_trunc(${bucket}, e."created_at" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AS bucket,
        COUNT(*)::bigint AS c
      FROM "Event" e
      WHERE ${eventFilter}
        AND e."created_at" >= ${querySince}
        AND e."created_at" <= ${until}
      GROUP BY 1
      ORDER BY 1
    `),
    prisma.$queryRaw<{ name: string; c: bigint }[]>(Prisma.sql`
      SELECT
        e."name" AS name,
        COUNT(*)::bigint AS c
      FROM "Event" e
      WHERE ${eventFilter}
        AND e."created_at" >= ${since}
        AND e."created_at" <= ${until}
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT ${EVENTS_TOP_EVENTS_LIMIT}
    `),
    prisma.$queryRaw<{ platform: string; c: bigint }[]>(Prisma.sql`
      SELECT
        ${platformExpr} AS platform,
        COUNT(*)::bigint AS c
      FROM "Event" e
      WHERE ${eventFilter}
        AND e."created_at" >= ${since}
        AND e."created_at" <= ${until}
      GROUP BY 1
      ORDER BY 2 DESC
    `),
    prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS c
      FROM "Event" e
      WHERE ${eventFilter}
        AND e."created_at" >= ${since}
        AND e."created_at" <= ${until}
    `),
  ]);

  const volume = mergeEventsVolumeBuckets(
    expectedBuckets,
    bucketRows.map((row) => ({
      bucket: row.bucket,
      count: Number(row.c),
    }))
  );

  const grandTotal = Number(totalRows[0]?.c ?? 0);
  const topEvents = buildTopEvents(
    topRows.map((row) => ({
      name: String(row.name),
      count: Number(row.c),
    })),
    grandTotal
  );

  const platforms = mergePlatformBreakdown(
    platformRows.map((row) => ({
      platform: String(row.platform),
      count: Number(row.c),
    }))
  );

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
    topEvents,
    platforms,
  };
}
