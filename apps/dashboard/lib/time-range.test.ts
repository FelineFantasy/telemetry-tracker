import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASHBOARD_TIME_RANGE,
  buildUnselectedTimeRange,
  hasExplicitTimeRangeQuery,
  listTimeRangeHiddenFields,
  resolveMetricsUntilIso,
} from "./time-range";
import { redirectHrefIfMissingTimeRange, mergeDashboardUrlParams } from "./list-filters-url";

describe("hasExplicitTimeRangeQuery", () => {
  it("is false when no time params", () => {
    expect(hasExplicitTimeRangeQuery({})).toBe(false);
  });

  it("is true for presets and intentional unselected", () => {
    expect(hasExplicitTimeRangeQuery({ range: "24h" })).toBe(true);
    expect(hasExplicitTimeRangeQuery({ range: "none" })).toBe(true);
    expect(hasExplicitTimeRangeQuery({ from: "2026-01-01" })).toBe(true);
  });
});

describe("redirectHrefIfMissingTimeRange", () => {
  it("adds default range on first visit", () => {
    expect(
      redirectHrefIfMissingTimeRange("/dashboard/overview", { app: "ios" })
    ).toBe(`/dashboard/overview?app=ios&range=${DEFAULT_DASHBOARD_TIME_RANGE}`);
  });

  it("returns null when range is explicit", () => {
    expect(
      redirectHrefIfMissingTimeRange("/dashboard/overview", { range: "none" })
    ).toBeNull();
  });
});

describe("mergeDashboardUrlParams", () => {
  it("drops API-only keys from merged params", () => {
    expect(
      mergeDashboardUrlParams(
        { range: "24h", page: "1" },
        { page: "2", sort: "duration", metricsUntil: "2026-01-01T00:00:00.000Z", view: "grouped" }
      )
    ).toEqual({ range: "24h", page: "2", sort: "duration" });
  });
});

describe("listTimeRangeHiddenFields", () => {
  it("preserves no-date filter for GET filter forms", () => {
    const range = buildUnselectedTimeRange();
    expect(listTimeRangeHiddenFields(range)).toEqual({ range: "none" });
  });
});

describe("resolveMetricsUntilIso", () => {
  it("honors a valid ISO metricsUntil from the URL", () => {
    const iso = "2026-03-15T12:00:00.000Z";
    expect(resolveMetricsUntilIso(iso)).toBe(iso);
  });

  it("falls back to now when missing or invalid", () => {
    const now = new Date("2026-07-18T10:00:00.000Z");
    expect(resolveMetricsUntilIso(undefined, now)).toBe(now.toISOString());
    expect(resolveMetricsUntilIso("", now)).toBe(now.toISOString());
    expect(resolveMetricsUntilIso("not-a-date", now)).toBe(now.toISOString());
  });
});
