import { describe, expect, it } from "vitest";
import {
  buildTopErrorTypes,
  mergeErrorsByTypeBuckets,
} from "./errors-analytics.js";

describe("mergeErrorsByTypeBuckets", () => {
  const buckets = [
    new Date("2026-06-01T00:00:00.000Z"),
    new Date("2026-06-02T00:00:00.000Z"),
  ];

  it("zero-fills missing buckets and types", () => {
    const { stacked, totals } = mergeErrorsByTypeBuckets(buckets, []);
    expect(stacked).toHaveLength(2);
    expect(stacked[0]).toMatchObject({
      t: "2026-06-01T00:00:00.000Z",
      TypeError: 0,
      Other: 0,
    });
    expect([...totals.values()].every((v) => v === 0)).toBe(true);
  });

  it("aggregates counts per bucket and type", () => {
    const { stacked, totals } = mergeErrorsByTypeBuckets(buckets, [
      {
        bucket: buckets[0]!,
        error_type: "TypeError",
        count: 3,
      },
      {
        bucket: buckets[0]!,
        error_type: "ReferenceError",
        count: 1,
      },
      {
        bucket: buckets[1]!,
        error_type: "TypeError",
        count: 2,
      },
    ]);

    expect(stacked[0]!.TypeError).toBe(3);
    expect(stacked[0]!["ReferenceError"]).toBe(1);
    expect(stacked[1]!.TypeError).toBe(2);
    expect(totals.get("TypeError")).toBe(5);
    expect(totals.get("ReferenceError")).toBe(1);
  });
});

describe("buildTopErrorTypes", () => {
  it("ranks by count and computes share percentages", () => {
    const totals = new Map([
      ["TypeError", 60],
      ["ReferenceError", 30],
      ["Other", 10],
    ] as const);
    const byType = new Map(
      [...totals.keys()].map((type) => [type, [{ t: "2026-06-01T00:00:00.000Z", count: 1 }]])
    );

    const top = buildTopErrorTypes(totals, byType, 2);
    expect(top).toHaveLength(2);
    expect(top[0]!.type).toBe("TypeError");
    expect(top[0]!.count).toBe(60);
    expect(top[0]!.sharePct).toBeCloseTo(60);
    expect(top[1]!.type).toBe("ReferenceError");
    expect(top[1]!.sharePct).toBeCloseTo(30);
  });

  it("omits zero-count types", () => {
    const totals = new Map([["Other", 0], ["TypeError", 4]] as const);
    const byType = new Map([
      ["TypeError", [{ t: "2026-06-01T00:00:00.000Z", count: 4 }]],
      ["Other", [{ t: "2026-06-01T00:00:00.000Z", count: 0 }]],
    ] as const);

    expect(buildTopErrorTypes(totals, byType)).toEqual([
      {
        type: "TypeError",
        count: 4,
        sharePct: 100,
        sparkline: [{ t: "2026-06-01T00:00:00.000Z", count: 4 }],
      },
    ]);
  });
});
