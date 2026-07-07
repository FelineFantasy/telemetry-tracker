import { describe, expect, it } from "vitest";
import {
  buildTopEvents,
  mergeEventsVolumeBuckets,
  mergePlatformBreakdown,
  normalizeEventPlatform,
} from "./events-analytics.js";
import {
  generateOverviewChartBuckets,
  overviewChartQuerySince,
} from "./overview-timeseries.js";

describe("mergeEventsVolumeBuckets", () => {
  const buckets = [
    new Date("2026-06-01T00:00:00.000Z"),
    new Date("2026-06-02T00:00:00.000Z"),
  ];

  it("zero-fills missing buckets", () => {
    const volume = mergeEventsVolumeBuckets(buckets, []);
    expect(volume).toEqual([
      { t: "2026-06-01T00:00:00.000Z", count: 0 },
      { t: "2026-06-02T00:00:00.000Z", count: 0 },
    ]);
  });

  it("maps bucket counts onto expected keys", () => {
    const volume = mergeEventsVolumeBuckets(buckets, [
      { bucket: buckets[0]!, count: 4 },
      { bucket: buckets[1]!, count: 9 },
    ]);
    expect(volume[0]!.count).toBe(4);
    expect(volume[1]!.count).toBe(9);
  });
});

describe("buildTopEvents", () => {
  it("ranks by count and computes share percentages", () => {
    const top = buildTopEvents(
      [
        { name: "page_view", count: 60 },
        { name: "click", count: 30 },
        { name: "signup", count: 10 },
      ],
      100,
      2
    );

    expect(top).toEqual([
      { name: "page_view", count: 60, sharePct: 60 },
      { name: "click", count: 30, sharePct: 30 },
    ]);
  });

  it("omits zero-count rows", () => {
    expect(
      buildTopEvents(
        [
          { name: "active", count: 5 },
          { name: "idle", count: 0 },
        ],
        20
      )
    ).toEqual([{ name: "active", count: 5, sharePct: 25 }]);
  });
});

describe("mergePlatformBreakdown", () => {
  it("normalizes categories and computes share percentages", () => {
    const slices = mergePlatformBreakdown([
      { platform: "Web", count: 50 },
      { platform: "iOS", count: 30 },
      { platform: "Android", count: 20 },
    ]);

    expect(slices).toEqual([
      { platform: "Web", count: 50, sharePct: 50 },
      { platform: "iOS", count: 30, sharePct: 30 },
      { platform: "Android", count: 20, sharePct: 20 },
    ]);
  });

  it("drops zero-count categories", () => {
    expect(
      mergePlatformBreakdown([{ platform: "Other", count: 12 }])
    ).toEqual([{ platform: "Other", count: 12, sharePct: 100 }]);
  });
});

describe("normalizeEventPlatform", () => {
  it("maps common SDK platform strings", () => {
    expect(normalizeEventPlatform("web")).toBe("Web");
    expect(normalizeEventPlatform("iOS")).toBe("iOS");
    expect(normalizeEventPlatform("android")).toBe("Android");
    expect(normalizeEventPlatform("react-native")).toBe("Other");
    expect(normalizeEventPlatform(null)).toBe("Other");
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
