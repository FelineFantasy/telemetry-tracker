import { describe, expect, it } from "vitest";
import { computeOverviewHealth, resolveCompareWindow } from "./overview-stats.js";

describe("resolveCompareWindow", () => {
  it("offsets week-ago comparison for 7d range", () => {
    const currentSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { previousSince, previousUntil } = resolveCompareWindow(
      "7d",
      "week-ago",
      currentSince
    );
    const weekAgoEnd = new Date(currentSince.getTime() - 6 * 24 * 60 * 60 * 1000);
    const weekAgoStart = new Date(weekAgoEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    expect(previousUntil?.getTime()).toBe(weekAgoEnd.getTime());
    expect(previousSince.getTime()).toBe(weekAgoStart.getTime());
  });

  it("uses immediately prior window for previous compare on 7d", () => {
    const currentSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { previousSince, previousUntil } = resolveCompareWindow(
      "7d",
      "previous",
      currentSince
    );

    expect(previousUntil?.getTime()).toBe(currentSince.getTime());
    expect(previousSince.getTime()).toBe(currentSince.getTime() - 7 * 24 * 60 * 60 * 1000);
  });

  it("anchors previous compare end to the supplied current window start", () => {
    const currentSince = new Date("2026-05-01T12:00:00.000Z");
    const { previousSince, previousUntil } = resolveCompareWindow(
      "24h",
      "previous",
      currentSince
    );

    expect(previousUntil).toEqual(currentSince);
    expect(previousSince).toEqual(new Date("2026-04-30T12:00:00.000Z"));
  });
});

describe("computeOverviewHealth", () => {
  it("marks operational when error rate is low", () => {
    const h = computeOverviewHealth(1000, 5, 900, 10, [
      { t: "2026-01-01T00:00:00.000Z", count: 3600 },
    ]);
    expect(h.status).toBe("operational");
    expect(h.successRatePct).toBeGreaterThan(99);
    expect(h.throughputPerSec).toBe(1);
  });

  it("marks outage when error rate is high", () => {
    const h = computeOverviewHealth(100, 900, 100, 100, [
      { t: "2026-01-01T00:00:00.000Z", count: 100 },
    ]);
    expect(h.status).toBe("outage");
  });

  it("uses daily bucket seconds for 7d throughput", () => {
    const h = computeOverviewHealth(
      1000,
      5,
      900,
      10,
      [{ t: "2026-01-01T00:00:00.000Z", count: 86_400 }],
      "7d"
    );
    expect(h.throughputPerSec).toBe(1);
    expect(h.peakThroughputPerSec).toBe(1);
  });
});
