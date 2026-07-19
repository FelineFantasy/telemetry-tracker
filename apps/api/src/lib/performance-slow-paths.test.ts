import { describe, expect, it } from "vitest";
import {
  compareSlowPages,
  compareSlowRoutes,
  computeErrorRatePct,
  isSmallSample,
  paginateRows,
  PERFORMANCE_SMALL_SAMPLE_THRESHOLD,
  sortSlowPages,
  sortSlowRoutes,
  type SlowPageRow,
  type SlowRouteRow,
} from "./performance-slow-paths.js";

function route(
  partial: Partial<SlowRouteRow> & Pick<SlowRouteRow, "method" | "url">
): SlowRouteRow {
  return {
    count: 10,
    p50Ms: 100,
    p95Ms: 200,
    errorRatePct: 0,
    smallSample: false,
    ...partial,
  };
}

function page(
  partial: Partial<SlowPageRow> & Pick<SlowPageRow, "path">
): SlowPageRow {
  return {
    lcpP75: 2000,
    clsP75: 0.05,
    sampleCount: 20,
    smallSample: false,
    ...partial,
  };
}

describe("isSmallSample", () => {
  it("flags positive counts below the threshold", () => {
    expect(isSmallSample(1)).toBe(true);
    expect(isSmallSample(PERFORMANCE_SMALL_SAMPLE_THRESHOLD - 1)).toBe(true);
    expect(isSmallSample(PERFORMANCE_SMALL_SAMPLE_THRESHOLD)).toBe(false);
    expect(isSmallSample(0)).toBe(false);
  });
});

describe("computeErrorRatePct", () => {
  it("returns null when no status samples exist", () => {
    expect(computeErrorRatePct(0, 0)).toBeNull();
    expect(computeErrorRatePct(3, 0)).toBeNull();
  });

  it("rounds to one decimal place", () => {
    expect(computeErrorRatePct(1, 3)).toBe(33.3);
    expect(computeErrorRatePct(0, 10)).toBe(0);
    expect(computeErrorRatePct(1, 2)).toBe(50);
  });
});

describe("sortSlowRoutes", () => {
  it("sorts by p95 desc with deterministic ties", () => {
    const rows = [
      route({ method: "GET", url: "/a", p95Ms: 100, p50Ms: 50, count: 5 }),
      route({ method: "POST", url: "/b", p95Ms: 300, p50Ms: 80, count: 2 }),
      route({ method: "GET", url: "/c", p95Ms: 300, p50Ms: 90, count: 2 }),
      route({ method: "GET", url: "/d", p95Ms: 300, p50Ms: 90, count: 9 }),
      route({ method: "GET", url: "/e", p95Ms: null, p50Ms: 10, count: 1 }),
    ];
    const sorted = sortSlowRoutes(rows);
    expect(sorted.map((r) => r.url)).toEqual(["/d", "/c", "/b", "/a", "/e"]);
  });

  it("breaks remaining ties by method then url", () => {
    const a = route({ method: "POST", url: "/z", p95Ms: 100, p50Ms: 50, count: 1 });
    const b = route({ method: "GET", url: "/z", p95Ms: 100, p50Ms: 50, count: 1 });
    const c = route({ method: "GET", url: "/a", p95Ms: 100, p50Ms: 50, count: 1 });
    expect(compareSlowRoutes(a, b)).toBeGreaterThan(0);
    expect(compareSlowRoutes(b, c)).toBeGreaterThan(0);
  });
});

describe("sortSlowPages", () => {
  it("sorts by LCP p75 desc with deterministic ties", () => {
    const rows = [
      page({ path: "/a", lcpP75: 1000, sampleCount: 5 }),
      page({ path: "/b", lcpP75: 4000, sampleCount: 2 }),
      page({ path: "/c", lcpP75: 4000, sampleCount: 9 }),
      page({ path: "/d", lcpP75: null, sampleCount: 3 }),
    ];
    const sorted = sortSlowPages(rows);
    expect(sorted.map((r) => r.path)).toEqual(["/c", "/b", "/a", "/d"]);
  });

  it("breaks remaining ties by path", () => {
    const a = page({ path: "/z", lcpP75: 1000, sampleCount: 5 });
    const b = page({ path: "/a", lcpP75: 1000, sampleCount: 5 });
    expect(compareSlowPages(a, b)).toBeGreaterThan(0);
  });
});

describe("paginateRows", () => {
  it("slices pages and clamps out-of-range page numbers", () => {
    const rows = [1, 2, 3, 4, 5];
    expect(paginateRows(rows, 1, 2)).toEqual({
      items: [1, 2],
      total: 5,
      page: 1,
      pageSize: 2,
    });
    expect(paginateRows(rows, 3, 2)).toEqual({
      items: [5],
      total: 5,
      page: 3,
      pageSize: 2,
    });
    expect(paginateRows(rows, 99, 2).page).toBe(3);
    expect(paginateRows([], 5, 10)).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 10,
    });
  });
});
