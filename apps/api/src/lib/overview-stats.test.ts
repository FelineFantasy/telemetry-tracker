import { describe, expect, it } from "vitest";
import { computeOverviewHealth, resolveCompareWindow } from "./overview-stats.js";

describe("resolveCompareWindow", () => {
  it("offsets week-ago comparison for 7d range", () => {
    const now = Date.now();
    const { previousSince, previousUntil } = resolveCompareWindow("7d", "week-ago");
    const currentSince = now - 7 * 24 * 60 * 60 * 1000;
    const weekAgoEnd = currentSince - 6 * 24 * 60 * 60 * 1000;
    const weekAgoStart = weekAgoEnd - 7 * 24 * 60 * 60 * 1000;

    expect(previousUntil?.getTime()).toBeCloseTo(weekAgoEnd, -3);
    expect(previousSince.getTime()).toBeCloseTo(weekAgoStart, -3);
  });

  it("uses immediately prior window for previous compare on 7d", () => {
    const now = Date.now();
    const { previousSince, previousUntil } = resolveCompareWindow("7d", "previous");
    const currentSince = now - 7 * 24 * 60 * 60 * 1000;

    expect(previousUntil?.getTime()).toBeCloseTo(currentSince, -3);
    expect(previousSince.getTime()).toBeCloseTo(currentSince - 7 * 24 * 60 * 60 * 1000, -3);
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
