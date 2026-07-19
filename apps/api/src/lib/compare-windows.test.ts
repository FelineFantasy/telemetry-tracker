import { describe, expect, it } from "vitest";
import {
  compareLabelForMode,
  durationsEqual,
  parseCompareMode,
  percentChange,
  percentChangeOrNew,
  resolveCompareWindow,
  resolveCompareWindows,
  startOfUtcDay,
  startOfUtcIsoWeek,
  startOfUtcMonth,
} from "./compare-windows.js";

describe("parseCompareMode", () => {
  it("defaults unknown values to previous", () => {
    expect(parseCompareMode(undefined)).toBe("previous");
    expect(parseCompareMode("nope")).toBe("previous");
  });

  it("accepts calendar and custom modes", () => {
    expect(parseCompareMode("today-yesterday")).toBe("today-yesterday");
    expect(parseCompareMode("week")).toBe("week");
    expect(parseCompareMode("month")).toBe("month");
    expect(parseCompareMode("custom")).toBe("custom");
    expect(parseCompareMode("week-ago")).toBe("week-ago");
  });
});

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

  it("uses immediately prior window for previous compare", () => {
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

describe("resolveCompareWindows calendar presets (UTC)", () => {
  const anchor = new Date("2026-07-15T15:30:00.000Z"); // Wednesday

  it("today-yesterday uses equal-length UTC day windows", () => {
    const result = resolveCompareWindows({
      mode: "today-yesterday",
      since: new Date("2026-01-01T00:00:00.000Z"),
      until: anchor,
      anchor,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.windows.since).toEqual(startOfUtcDay(anchor));
    expect(result.windows.until).toEqual(anchor);
    expect(result.windows.label).toBe("Today");
    expect(result.windows.compareLabel).toBe("vs yesterday");
    const duration =
      result.windows.until.getTime() - result.windows.since.getTime();
    expect(
      result.windows.previousUntil.getTime() -
        result.windows.previousSince.getTime()
    ).toBe(duration);
    expect(result.windows.previousSince).toEqual(
      new Date("2026-07-14T00:00:00.000Z")
    );
  });

  it("week uses ISO week starting Monday UTC", () => {
    const result = resolveCompareWindows({
      mode: "week",
      since: new Date("2026-01-01T00:00:00.000Z"),
      until: anchor,
      anchor,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.windows.since).toEqual(startOfUtcIsoWeek(anchor));
    expect(result.windows.since.toISOString()).toBe("2026-07-13T00:00:00.000Z");
    expect(result.windows.label).toBe("This week");
    expect(result.windows.compareLabel).toBe("vs last week");
  });

  it("month uses UTC month start with equal-length prior window", () => {
    const result = resolveCompareWindows({
      mode: "month",
      since: new Date("2026-01-01T00:00:00.000Z"),
      until: anchor,
      anchor,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.windows.since).toEqual(startOfUtcMonth(anchor));
    expect(result.windows.since.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(result.windows.previousSince.toISOString()).toBe(
      "2026-06-01T00:00:00.000Z"
    );
    expect(result.windows.label).toBe("This month");
    expect(result.windows.compareLabel).toBe("vs last month");
  });

  it("rejects custom ranges with unequal duration", () => {
    const result = resolveCompareWindows({
      mode: "custom",
      since: new Date("2026-07-01T00:00:00.000Z"),
      until: new Date("2026-07-08T00:00:00.000Z"),
      custom: {
        compareFrom: "2026-06-01T00:00:00.000Z",
        compareTo: "2026-06-02T00:00:00.000Z",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/equal duration/i);
  });

  it("accepts custom equal-duration ranges", () => {
    const result = resolveCompareWindows({
      mode: "custom",
      since: new Date("2026-07-01T00:00:00.000Z"),
      until: new Date("2026-07-08T00:00:00.000Z"),
      custom: {
        compareFrom: "2026-06-24T00:00:00.000Z",
        compareTo: "2026-07-01T00:00:00.000Z",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.windows.compareLabel).toBe("vs custom period");
    expect(result.windows.previousSince.toISOString()).toBe(
      "2026-06-24T00:00:00.000Z"
    );
  });

  it("falls back to previous when custom bounds are missing", () => {
    const since = new Date("2026-07-01T00:00:00.000Z");
    const until = new Date("2026-07-08T00:00:00.000Z");
    const result = resolveCompareWindows({
      mode: "custom",
      since,
      until,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.windows.mode).toBe("previous");
    expect(result.windows.compareLabel).toBe("vs prior period");
  });
});

describe("percentChangeOrNew / percentChange", () => {
  it("returns New for 0 → positive", () => {
    expect(percentChangeOrNew(120, 0)).toEqual({ kind: "new" });
    expect(percentChange(120, 0)).toBeNull();
  });

  it("returns none for 0 → 0", () => {
    expect(percentChangeOrNew(0, 0)).toEqual({ kind: "none" });
    expect(percentChange(0, 0)).toBeNull();
  });

  it("returns relative percent for normal cases", () => {
    expect(percentChangeOrNew(60, 120)).toEqual({ kind: "pct", value: -50 });
    expect(percentChangeOrNew(24, 12)).toEqual({ kind: "pct", value: 100 });
    expect(percentChange(130, 100)).toBe(30);
  });
});

describe("durationsEqual / compareLabelForMode", () => {
  it("tolerates sub-second duration differences", () => {
    expect(durationsEqual(1000, 1500)).toBe(true);
    expect(durationsEqual(1000, 3000)).toBe(false);
  });

  it("builds labels for each mode", () => {
    expect(compareLabelForMode("today-yesterday", "x")).toBe("vs yesterday");
    expect(compareLabelForMode("previous", "Last 7 days")).toBe(
      "vs prior 7 days"
    );
  });
});
