import { describe, expect, it } from "vitest";
import {
  OVERVIEW_CHART_MAX_BUCKETS,
  generateOverviewChartBuckets,
} from "./overview-timeseries.js";

describe("generateOverviewChartBuckets", () => {
  it("anchors wide windows on until so recent buckets are included", () => {
    const since = new Date("1970-01-01T00:00:00.000Z");
    const until = new Date("2026-03-15T00:00:00.000Z");
    const buckets = generateOverviewChartBuckets(since, until, "week");

    expect(buckets.length).toBeLessThanOrEqual(OVERVIEW_CHART_MAX_BUCKETS);
    expect(buckets.at(-1)?.toISOString()).toBe("2026-03-09T00:00:00.000Z");
    expect(buckets[0]!.getTime()).toBeGreaterThan(since.getTime());
  });

  it("fills every bucket when the span fits within the cap", () => {
    const since = new Date("2026-03-01T00:00:00.000Z");
    const until = new Date("2026-03-08T00:00:00.000Z");
    const buckets = generateOverviewChartBuckets(since, until, "day");

    expect(buckets).toHaveLength(8);
    expect(buckets[0]!.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(buckets.at(-1)!.toISOString()).toBe("2026-03-08T00:00:00.000Z");
  });
});
