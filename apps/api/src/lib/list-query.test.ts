import { describe, expect, it, vi, afterEach } from "vitest";
import { parseCreatedRange } from "./list-query.js";

describe("parseCreatedRange", () => {
  const now = new Date("2026-06-28T12:00:00.000Z");

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns no bounds for all preset", () => {
    expect(parseCreatedRange({ range: "all" }, "all")).toEqual({});
    expect(parseCreatedRange({}, "all")).toEqual({});
  });

  it("parses 14d relative range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const { gte } = parseCreatedRange({ range: "14d" }, "all");
    expect(gte?.toISOString()).toBe("2026-06-14T12:00:00.000Z");
  });

  it("parses custom 8w range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const { gte } = parseCreatedRange({ range: "8w" }, "all");
    expect(gte?.getTime()).toBe(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
  });

  it("parses absolute from/to", () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const { gte, lte } = parseCreatedRange(
      { from: "2026-03-01", to: "2026-03-28" },
      "all"
    );
    expect(gte?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(lte?.toISOString()).toBe("2026-03-28T23:59:59.999Z");
  });

  it("defaults list pages to all time when range omitted", () => {
    expect(parseCreatedRange({}, "all")).toEqual({});
  });
});
