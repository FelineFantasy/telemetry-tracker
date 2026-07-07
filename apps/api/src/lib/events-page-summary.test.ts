import { describe, expect, it, vi, afterEach } from "vitest";
import {
  enrichEventListFilterForMetrics,
  parseEventsMetricsAnchor,
  resolveEventsSummaryWindow,
} from "./events-page-summary.js";

describe("parseEventsMetricsAnchor", () => {
  it("parses ISO metricsUntil", () => {
    const iso = "2026-06-28T12:00:00.000Z";
    expect(parseEventsMetricsAnchor(iso).toISOString()).toBe(iso);
  });

  it("falls back to now when metricsUntil is missing or invalid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T12:00:00.000Z"));
    expect(parseEventsMetricsAnchor(undefined).toISOString()).toBe(
      "2026-06-28T12:00:00.000Z"
    );
    expect(parseEventsMetricsAnchor("not-a-date").toISOString()).toBe(
      "2026-06-28T12:00:00.000Z"
    );
    vi.useRealTimers();
  });
});

describe("default metrics window alignment", () => {
  const anchor = new Date("2026-06-28T12:00:00.000Z");

  it("uses the same bounds for summary and in-range counts", () => {
    const window = resolveEventsSummaryWindow({}, anchor);
    const enriched = enrichEventListFilterForMetrics({ range: {} }, {}, anchor);
    expect(enriched.eventCountRange?.gte).toEqual(window.since);
    expect(enriched.eventCountRange?.lte).toEqual(window.until);
  });
});

describe("resolveEventsSummaryWindow", () => {
  const anchor = new Date("2026-06-28T12:00:00.000Z");
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to last 7 days when range has no lower bound", () => {
    vi.useFakeTimers();
    vi.setSystemTime(anchor);
    const until = new Date("2026-06-28T00:00:00.000Z");
    const w = resolveEventsSummaryWindow({ lte: until }, anchor);

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
    const w = resolveEventsSummaryWindow({ gte: since, lte: until }, anchor);

    expect(w.label).toBe("Selected period");
    expect(w.since).toEqual(since);
    expect(w.until).toEqual(until);
    expect(w.previousUntil.getTime()).toBe(since.getTime());
    expect(w.previousSince.getTime()).toBe(
      since.getTime() - (until.getTime() - since.getTime())
    );
  });
});

describe("enrichEventListFilterForMetrics", () => {
  const anchor = new Date("2026-06-28T12:00:00.000Z");

  it("adds default 7-day event window when list range is all-time", () => {
    const enriched = enrichEventListFilterForMetrics({ range: {} }, {}, anchor);
    expect(enriched.eventCountRange?.gte.getTime()).toBe(
      anchor.getTime() - 7 * 24 * 60 * 60 * 1000
    );
    expect(enriched.eventCountRange?.lte).toEqual(anchor);
  });

  it("leaves filter unchanged when list range has explicit start and end", () => {
    const since = new Date("2026-06-01T00:00:00.000Z");
    const until = new Date("2026-06-08T00:00:00.000Z");
    const filter = { range: { gte: since, lte: until } };
    expect(enrichEventListFilterForMetrics(filter, filter.range, anchor)).toEqual(filter);
  });

  it("adds upper bound when list range has only a start date", () => {
    const since = new Date("2026-06-01T00:00:00.000Z");
    const filter = { range: { gte: since } };
    const window = resolveEventsSummaryWindow(filter.range, anchor);
    const enriched = enrichEventListFilterForMetrics(filter, filter.range, anchor);
    expect(enriched.eventCountRange?.gte).toEqual(window.since);
    expect(enriched.eventCountRange?.lte).toEqual(window.until);
    expect(enriched.eventCountRange?.lte).toEqual(anchor);
  });
});
