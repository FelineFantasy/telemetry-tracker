import { describe, expect, it, vi, afterEach } from "vitest";
import {
  attachPreviousReleaseComparisons,
  errorRatePpDelta,
  parseReleasesOrderParam,
  parseReleasesSortParam,
  percentChange,
  releaseAdoptionSharePct,
  releaseErrorRatePct,
  resolveReleasesSummaryWindow,
  sortReleaseHealthRows,
  type ReleaseHealthRow,
} from "./releases-page-summary.js";
import {
  isUnknownReleaseKey,
  releaseDisplayLabel,
  releaseKeyFromDbValue,
  UNKNOWN_RELEASE_KEY,
} from "./release-key.js";

function row(partial: Partial<ReleaseHealthRow> & Pick<ReleaseHealthRow, "releaseKey">): ReleaseHealthRow {
  return {
    release: isUnknownReleaseKey(partial.releaseKey) ? null : partial.releaseKey,
    releaseKey: partial.releaseKey,
    firstSeenAt: partial.firstSeenAt ?? "2026-01-01T00:00:00.000Z",
    lastSeenAt: partial.lastSeenAt ?? "2026-01-02T00:00:00.000Z",
    sessions: partial.sessions ?? 0,
    activeUsers: partial.activeUsers ?? 0,
    events: partial.events ?? 0,
    errors: partial.errors ?? 0,
    errorRatePct: partial.errorRatePct ?? null,
    adoptionSharePct: partial.adoptionSharePct ?? 0,
    previousReleaseKey: partial.previousReleaseKey ?? null,
    vsPrevious: partial.vsPrevious ?? null,
  };
}

describe("release-key", () => {
  it("maps null/blank to Unknown sentinel", () => {
    expect(releaseKeyFromDbValue(null)).toBe(UNKNOWN_RELEASE_KEY);
    expect(releaseKeyFromDbValue("")).toBe(UNKNOWN_RELEASE_KEY);
    expect(releaseKeyFromDbValue("  ")).toBe(UNKNOWN_RELEASE_KEY);
    expect(releaseKeyFromDbValue("1.2.3")).toBe("1.2.3");
  });

  it("labels Unknown for display", () => {
    expect(releaseDisplayLabel(UNKNOWN_RELEASE_KEY)).toBe("Unknown");
    expect(releaseDisplayLabel("abc")).toBe("abc");
  });
});

describe("releaseErrorRatePct / adoption", () => {
  it("returns null error rate when sessions are zero", () => {
    expect(releaseErrorRatePct(12, 0)).toBeNull();
    expect(releaseErrorRatePct(0, 0)).toBeNull();
  });

  it("computes error rate and adoption share", () => {
    expect(releaseErrorRatePct(25, 1000)).toBe(2.5);
    expect(releaseAdoptionSharePct(250, 1000)).toBe(25);
    expect(releaseAdoptionSharePct(0, 0)).toBe(0);
  });
});

describe("percentChange / errorRatePpDelta", () => {
  it("returns null percent change when previous is zero", () => {
    expect(percentChange(10, 0)).toBeNull();
  });

  it("computes deltas", () => {
    expect(percentChange(130, 100)).toBe(30);
    expect(errorRatePpDelta(2.8, 1.4)).toBe(1.4);
    expect(errorRatePpDelta(null, 1.4)).toBeNull();
  });
});

describe("resolveReleasesSummaryWindow", () => {
  const anchor = new Date("2026-06-28T12:00:00.000Z");
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to last 7 days when range is open", () => {
    vi.useFakeTimers();
    vi.setSystemTime(anchor);
    const w = resolveReleasesSummaryWindow({}, anchor);
    expect(w.until).toEqual(anchor);
    expect(w.since.getTime()).toBe(anchor.getTime() - sevenDaysMs);
    expect(w.label).toBe("Last 7 days");
  });

  it("uses explicit bounds", () => {
    const since = new Date("2026-06-01T00:00:00.000Z");
    const until = new Date("2026-06-08T00:00:00.000Z");
    const w = resolveReleasesSummaryWindow({ gte: since, lte: until });
    expect(w.since).toEqual(since);
    expect(w.until).toEqual(until);
    expect(w.label).toBe("Selected period");
  });
});

describe("parseReleasesSortParam / order", () => {
  it("defaults and validates sort", () => {
    expect(parseReleasesSortParam(undefined)).toEqual({ ok: true, sort: "recency" });
    expect(parseReleasesSortParam("adoption")).toEqual({ ok: true, sort: "adoption" });
    expect(parseReleasesSortParam("semver")).toEqual({ ok: false });
  });

  it("defaults and validates order", () => {
    expect(parseReleasesOrderParam(undefined)).toEqual({ ok: true, order: "desc" });
    expect(parseReleasesOrderParam("asc")).toEqual({ ok: true, order: "asc" });
    expect(parseReleasesOrderParam("sideways")).toEqual({ ok: false });
  });
});

describe("sortReleaseHealthRows", () => {
  const sample = [
    row({
      releaseKey: "b",
      firstSeenAt: "2026-01-02T00:00:00.000Z",
      sessions: 10,
      errors: 5,
      errorRatePct: 50,
      adoptionSharePct: 10,
    }),
    row({
      releaseKey: "a",
      firstSeenAt: "2026-01-01T00:00:00.000Z",
      sessions: 90,
      errors: 1,
      errorRatePct: 1.11,
      adoptionSharePct: 90,
    }),
    row({
      releaseKey: UNKNOWN_RELEASE_KEY,
      firstSeenAt: "2026-01-03T00:00:00.000Z",
      sessions: 0,
      errors: 3,
      errorRatePct: null,
      adoptionSharePct: 0,
    }),
  ];

  it("sorts by recency (first-seen) without semver assumptions", () => {
    const sorted = sortReleaseHealthRows(sample, "recency", "desc");
    expect(sorted.map((r) => r.releaseKey)).toEqual([
      UNKNOWN_RELEASE_KEY,
      "b",
      "a",
    ]);
  });

  it("sorts by adoption", () => {
    const sorted = sortReleaseHealthRows(sample, "adoption", "desc");
    expect(sorted[0]!.releaseKey).toBe("a");
  });

  it("puts null error rates last when sorting by error_rate desc", () => {
    const sorted = sortReleaseHealthRows(sample, "error_rate", "desc");
    expect(sorted.map((r) => r.releaseKey)).toEqual(["b", "a", UNKNOWN_RELEASE_KEY]);
  });
});

describe("attachPreviousReleaseComparisons", () => {
  it("chains previous by historical first-seen and excludes Unknown", () => {
    const rows = [
      row({
        releaseKey: "v2",
        firstSeenAt: "2026-02-01T00:00:00.000Z",
        sessions: 200,
        errors: 20,
        errorRatePct: 10,
      }),
      row({
        releaseKey: "v1",
        firstSeenAt: "2026-01-01T00:00:00.000Z",
        sessions: 100,
        errors: 5,
        errorRatePct: 5,
      }),
      row({
        releaseKey: UNKNOWN_RELEASE_KEY,
        firstSeenAt: "2025-12-01T00:00:00.000Z",
        sessions: 50,
        errors: 50,
        errorRatePct: 100,
      }),
    ];

    const withCompare = attachPreviousReleaseComparisons(rows);
    const v1 = withCompare.find((r) => r.releaseKey === "v1")!;
    const v2 = withCompare.find((r) => r.releaseKey === "v2")!;
    const unknown = withCompare.find((r) => r.releaseKey === UNKNOWN_RELEASE_KEY)!;

    expect(v1.previousReleaseKey).toBeNull();
    expect(v1.vsPrevious).toBeNull();
    expect(v2.previousReleaseKey).toBe("v1");
    expect(v2.vsPrevious).toEqual({
      errorRatePp: 5,
      sessionsPct: 100,
      errorsPct: 300,
    });
    expect(unknown.previousReleaseKey).toBeNull();
    expect(unknown.vsPrevious).toBeNull();
  });
});
