import { describe, expect, it, vi, afterEach } from "vitest";
import { resolveErrorsSummaryWindow, enrichErrorListFilterForMetrics } from "./errors-page-summary.js";

describe("resolveErrorsSummaryWindow", () => {
  const anchor = new Date("2026-06-28T12:00:00.000Z");
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to last 7 days when range has no lower bound", () => {
    vi.useFakeTimers();
    vi.setSystemTime(anchor);
    const until = new Date("2026-06-28T00:00:00.000Z");
    const w = resolveErrorsSummaryWindow({ lte: until }, anchor);

    expect(w.label).toBe("Last 7 days");
    expect(w.until.getTime()).toBe(until.getTime());
    expect(w.since.getTime()).toBe(until.getTime() - sevenDaysMs);
    expect(w.compareLabel).toBe("vs prior period");
    expect(w.previousUntil.getTime()).toBe(w.since.getTime());
    expect(w.previousSince.getTime()).toBe(w.since.getTime() - sevenDaysMs);
  });

  it("uses explicit range bounds and selected-period label", () => {
    const since = new Date("2026-06-01T00:00:00.000Z");
    const until = new Date("2026-06-08T00:00:00.000Z");
    const w = resolveErrorsSummaryWindow({ gte: since, lte: until }, anchor);

    expect(w.label).toBe("Selected period");
    expect(w.since).toEqual(since);
    expect(w.until).toEqual(until);
    expect(w.previousUntil.getTime()).toBe(since.getTime());
    expect(w.previousSince.getTime()).toBe(
      since.getTime() - (until.getTime() - since.getTime())
    );
  });
});

describe("enrichErrorListFilterForMetrics", () => {
  const anchor = new Date("2026-06-28T12:00:00.000Z");

  it("adds default 7-day occurrence window when list range is all-time", () => {
    const enriched = enrichErrorListFilterForMetrics(
      { range: {}, status: "all" },
      {},
      anchor
    );
    expect(enriched.occurrenceCountRange?.gte.getTime()).toBe(
      anchor.getTime() - 7 * 24 * 60 * 60 * 1000
    );
    expect(enriched.occurrenceCountRange?.lte).toEqual(anchor);
  });

  it("leaves filter unchanged when list range has a lower bound", () => {
    const since = new Date("2026-06-01T00:00:00.000Z");
    const filter = { range: { gte: since }, status: "all" as const };
    expect(enrichErrorListFilterForMetrics(filter, filter.range, anchor)).toEqual(filter);
  });
});
