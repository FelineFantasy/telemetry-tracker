import { describe, expect, it } from "vitest";
import { mergePlatformBreakdown } from "./events-analytics.js";
import { mergeSessionsVolumeBuckets } from "./sessions-analytics.js";
import {
  generateOverviewChartBuckets,
  overviewChartQuerySince,
} from "./overview-timeseries.js";
import { parseChartBucketParam, resolveChartBucket } from "./time-range.js";

describe("mergeSessionsVolumeBuckets", () => {
  const buckets = [
    new Date("2026-06-01T00:00:00.000Z"),
    new Date("2026-06-02T00:00:00.000Z"),
  ];

  it("zero-fills missing buckets", () => {
    const volume = mergeSessionsVolumeBuckets(buckets, []);
    expect(volume).toEqual([
      { t: "2026-06-01T00:00:00.000Z", count: 0 },
      { t: "2026-06-02T00:00:00.000Z", count: 0 },
    ]);
  });

  it("maps bucket counts onto expected keys", () => {
    const volume = mergeSessionsVolumeBuckets(buckets, [
      { bucket: buckets[0]!, count: 12 },
      { bucket: buckets[1]!, count: 7 },
    ]);
    expect(volume[0]!.count).toBe(12);
    expect(volume[1]!.count).toBe(7);
  });
});

describe("parseChartBucketParam", () => {
  it("accepts hour, day, and week", () => {
    expect(parseChartBucketParam("hour")).toBe("hour");
    expect(parseChartBucketParam("Day")).toBe("day");
    expect(parseChartBucketParam(" week ")).toBe("week");
  });

  it("rejects invalid values", () => {
    expect(parseChartBucketParam(undefined)).toBeUndefined();
    expect(parseChartBucketParam("month")).toBeUndefined();
  });
});

describe("resolveChartBucket", () => {
  it("uses override when provided", () => {
    expect(resolveChartBucket(7 * 24 * 60 * 60 * 1000, "hour")).toBe("hour");
  });

  it("auto-selects from duration when override is missing", () => {
    expect(resolveChartBucket(24 * 60 * 60 * 1000)).toBe("hour");
    expect(resolveChartBucket(14 * 24 * 60 * 60 * 1000)).toBe("day");
    expect(resolveChartBucket(120 * 24 * 60 * 60 * 1000)).toBe("week");
  });
});

describe("session platform breakdown", () => {
  it("normalizes platform categories with share percentages", () => {
    const slices = mergePlatformBreakdown([
      { platform: "Web", count: 40 },
      { platform: "iOS", count: 35 },
      { platform: "Android", count: 25 },
    ]);

    expect(slices).toEqual([
      { platform: "Web", count: 40, sharePct: 40 },
      { platform: "iOS", count: 35, sharePct: 35 },
      { platform: "Android", count: 25, sharePct: 25 },
    ]);
  });
});

describe("wide-window chart cap", () => {
  it("uses a later query lower bound than the KPI window when buckets are capped", () => {
    const since = new Date("1970-01-01T00:00:00.000Z");
    const until = new Date("2026-03-15T00:00:00.000Z");
    const buckets = generateOverviewChartBuckets(since, until, "day");
    const querySince = overviewChartQuerySince(since, until, "day");

    expect(buckets.length).toBe(120);
    expect(querySince.getTime()).toBeGreaterThan(since.getTime());
    expect(buckets[0]!.toISOString()).toBe(querySince.toISOString());
  });
});
