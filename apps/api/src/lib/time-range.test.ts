import { describe, expect, it } from "vitest";
import {
  parseOverviewTimeRangeQuery,
  parseTimeRangeQuery,
  tryParseCustomRelativeInput,
} from "./time-range.js";

describe("parseTimeRangeQuery", () => {
  const now = new Date("2026-06-28T12:00:00.000Z");

  it("parses 14d preset", () => {
    const r = parseTimeRangeQuery({ range: "14d" }, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.range.key).toBe("14d");
    expect(r.range.label).toBe("14 days");
    expect(r.range.gte.toISOString()).toBe("2026-06-14T12:00:00.000Z");
    expect(r.range.bucket).toBe("day");
  });

  it("parses custom 8w", () => {
    const r = parseTimeRangeQuery({ range: "8w" }, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.range.key).toBe("8w");
    expect(r.range.durationMs).toBe(8 * 7 * 24 * 60 * 60 * 1000);
  });

  it("parses absolute from/to", () => {
    const r = parseTimeRangeQuery(
      { from: "2026-03-01", to: "2026-03-28" },
      now
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.range.key).toBe("absolute");
    expect(r.range.gte.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(r.range.lte.toISOString()).toBe("2026-03-28T23:59:59.999Z");
  });
});

describe("parseOverviewTimeRangeQuery", () => {
  const now = new Date("2026-06-28T12:00:00.000Z");

  it("returns unselected when no query params", () => {
    const r = parseOverviewTimeRangeQuery({}, now);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.range.key).toBe("none");
    expect(r.range.label).toBe("Recent data");
  });
});

describe("tryParseCustomRelativeInput", () => {
  it("accepts shorthand durations", () => {
    expect(tryParseCustomRelativeInput("2h")).toBe("2h");
    expect(tryParseCustomRelativeInput("4d")).toBe("4d");
    expect(tryParseCustomRelativeInput("8w")).toBe("8w");
  });

  it("rejects invalid input", () => {
    expect(tryParseCustomRelativeInput("nope")).toBeNull();
  });
});
