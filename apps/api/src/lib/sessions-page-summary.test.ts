import { describe, expect, it, vi, afterEach } from "vitest";
import {
  BOUNCE_MAX_DURATION_SECONDS,
  parseSessionsMetricsAnchor,
  resolveSessionsSummaryWindow,
} from "./sessions-page-summary.js";

describe("parseSessionsMetricsAnchor", () => {
  it("parses ISO metricsUntil", () => {
    const iso = "2026-06-28T12:00:00.000Z";
    expect(parseSessionsMetricsAnchor(iso).toISOString()).toBe(iso);
  });

  it("falls back to now when metricsUntil is missing or invalid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T12:00:00.000Z"));
    expect(parseSessionsMetricsAnchor(undefined).toISOString()).toBe(
      "2026-06-28T12:00:00.000Z"
    );
    vi.useRealTimers();
  });
});

describe("resolveSessionsSummaryWindow", () => {
  const anchor = new Date("2026-06-28T12:00:00.000Z");
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to last 7 days when range has no lower bound", () => {
    vi.useFakeTimers();
    vi.setSystemTime(anchor);
    const until = new Date("2026-06-28T00:00:00.000Z");
    const w = resolveSessionsSummaryWindow({ lte: until }, anchor);
    expect(w.until).toEqual(until);
    expect(w.since.getTime()).toBe(until.getTime() - sevenDaysMs);
    expect(w.label).toBe("Last 7 days");
    vi.useRealTimers();
  });

  it("uses explicit range bounds", () => {
    const since = new Date("2026-06-01T00:00:00.000Z");
    const until = new Date("2026-06-08T00:00:00.000Z");
    const w = resolveSessionsSummaryWindow({ gte: since, lte: until });
    expect(w.since).toEqual(since);
    expect(w.until).toEqual(until);
    expect(w.label).toBe("Selected period");
  });
});

describe("BOUNCE_MAX_DURATION_SECONDS", () => {
  it("is 10 seconds", () => {
    expect(BOUNCE_MAX_DURATION_SECONDS).toBe(10);
  });
});
