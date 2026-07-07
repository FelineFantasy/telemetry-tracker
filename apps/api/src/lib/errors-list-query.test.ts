import { describe, expect, it, vi, afterEach } from "vitest";
import { parseTrendWindowParam, serializeErrorGroupListItem, isAggregateSort } from "./errors-list-query.js";

describe("isAggregateSort", () => {
  it("routes occurrences sort through the in-range aggregate path", () => {
    expect(isAggregateSort("occurrences")).toBe(true);
    expect(isAggregateSort("last_seen")).toBe(false);
  });
});

describe("serializeErrorGroupListItem", () => {
  const baseRow = {
    id: "eg_1",
    fingerprint: "fp",
    message: "boom",
    top_stack: null,
    app: "web",
    environment: "production",
    occurrences: 42,
    first_seen: new Date("2026-06-01T00:00:00.000Z"),
    last_seen: new Date("2026-06-08T00:00:00.000Z"),
    resolved_at: null,
  };

  it("defaults occurrences_in_range to zero when no in-range aggregate exists", () => {
    const item = serializeErrorGroupListItem(baseRow);
    expect(item.occurrences).toBe(42);
    expect(item.occurrences_in_range).toBe(0);
  });

  it("preserves explicit zero in-range counts", () => {
    const item = serializeErrorGroupListItem({
      ...baseRow,
      occurrences_in_range: 0,
    });
    expect(item.occurrences_in_range).toBe(0);
  });
});

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
