import { describe, expect, it } from "vitest";
import {
  buildWorkspaceTelemetry,
  computeOverviewHealth,
  errorGroupDetailHref,
  resolveCompareWindow,
} from "./overview-stats.js";

describe("resolveCompareWindow", () => {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  it("offsets week-ago comparison for 7d range", () => {
    const until = new Date("2026-06-28T12:00:00.000Z");
    const currentSince = new Date(until.getTime() - sevenDaysMs);
    const { previousSince, previousUntil } = resolveCompareWindow(
      sevenDaysMs,
      "week-ago",
      currentSince,
      until
    );
    const weekAgoEnd = new Date(until.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStart = new Date(weekAgoEnd.getTime() - sevenDaysMs);

    expect(previousUntil?.getTime()).toBe(weekAgoEnd.getTime());
    expect(previousSince.getTime()).toBe(weekAgoStart.getTime());
  });

  it("uses immediately prior window for previous compare on 7d", () => {
    const currentSince = new Date(Date.now() - sevenDaysMs);
    const { previousSince, previousUntil } = resolveCompareWindow(
      sevenDaysMs,
      "previous",
      currentSince
    );

    expect(previousUntil?.getTime()).toBe(currentSince.getTime());
    expect(previousSince.getTime()).toBe(currentSince.getTime() - sevenDaysMs);
  });

  it("anchors previous compare end to the supplied current window start", () => {
    const currentSince = new Date("2026-05-01T12:00:00.000Z");
    const dayMs = 24 * 60 * 60 * 1000;
    const { previousSince, previousUntil } = resolveCompareWindow(
      dayMs,
      "previous",
      currentSince
    );

    expect(previousUntil).toEqual(currentSince);
    expect(previousSince).toEqual(new Date("2026-04-30T12:00:00.000Z"));
  });
});

describe("errorGroupDetailHref", () => {
  it("includes active app and environment scope in the link", () => {
    expect(
      errorGroupDetailHref("eg_1", {
        app: "web",
        environment: "production",
      })
    ).toBe("/dashboard/errors/eg_1?app=web&environment=production");
  });

  it("omits query string when no scope filters are set", () => {
    expect(errorGroupDetailHref("eg_1", {})).toBe("/dashboard/errors/eg_1");
  });
});

describe("buildWorkspaceTelemetry", () => {
  it("derives ingest totals and breakdown from precomputed counts", () => {
    expect(buildWorkspaceTelemetry(1000, 50, 3, 2)).toEqual({
      ingestRequests: 1050,
      sdkEventRows: 1000,
      distinctApps: 3,
      distinctSdkVersions: 2,
    });
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
      86_400
    );
    expect(h.throughputPerSec).toBe(1);
    expect(h.peakThroughputPerSec).toBe(1);
  });
});
