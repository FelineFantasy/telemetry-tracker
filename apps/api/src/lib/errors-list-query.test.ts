import { describe, expect, it, vi, afterEach } from "vitest";
import { parseTrendWindowParam } from "./errors-list-query.js";

describe("parseTrendWindowParam", () => {
  const anchor = new Date("2026-06-28T12:00:00.000Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to 24h", () => {
    vi.useFakeTimers();
    vi.setSystemTime(anchor);
    const r = parseTrendWindowParam({}, anchor);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trend.key).toBe("24h");
    expect(r.trend.durationMs).toBe(24 * 60 * 60 * 1000);
  });

  it("accepts 14d and custom 8w", () => {
    vi.useFakeTimers();
    vi.setSystemTime(anchor);
    const r14 = parseTrendWindowParam({ trendWindow: "14d" }, anchor);
    expect(r14.ok).toBe(true);
    if (!r14.ok) return;
    expect(r14.trend.durationMs).toBe(14 * 24 * 60 * 60 * 1000);

    const r8w = parseTrendWindowParam({ trendWindow: "8w" }, anchor);
    expect(r8w.ok).toBe(true);
    if (!r8w.ok) return;
    expect(r8w.trend.durationMs).toBe(8 * 7 * 24 * 60 * 60 * 1000);
  });

  it("rejects all time", () => {
    const r = parseTrendWindowParam({ trendWindow: "all" }, anchor);
    expect(r.ok).toBe(false);
  });

  it("parses absolute trend range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(anchor);
    const r = parseTrendWindowParam(
      { trendFrom: "2026-03-01", trendTo: "2026-03-08" },
      anchor
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.trend.key).toBe("absolute");
    expect(r.trend.durationMs).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });
});
