import { describe, expect, it } from "vitest";
import {
  DEFAULT_DASHBOARD_TIME_RANGE,
  buildUnselectedTimeRange,
  hasExplicitTimeRangeQuery,
  listTimeRangeHiddenFields,
  resolveMetricsUntilIso,
} from "./time-range";
import { redirectHrefIfMissingTimeRange, mergeDashboardUrlParams, redirectHrefForMetricsUntil } from "./list-filters-url";

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
  it("drops view from list params and never invents it from the API", () => {
    expect(
      mergeDashboardUrlParams(
        { range: "24h", page: "1" },
        { page: "2", sort: "duration", view: "grouped" }
      )
    ).toEqual({ range: "24h", page: "2", sort: "duration" });
  });

  it("preserves metricsUntil from the URL for open-ended deep links", () => {
    expect(
      mergeDashboardUrlParams(
        { range: "none", metricsUntil: "2026-03-15T12:00:00.000Z" },
        { page: "2", sort: "duration", metricsUntil: "2026-07-18T10:00:00.000Z" }
      )
    ).toEqual({
      range: "none",
      page: "2",
      sort: "duration",
      metricsUntil: "2026-03-15T12:00:00.000Z",
    });
  });

  it("falls back to list/API metricsUntil when the URL omits it on open-ended ranges", () => {
    expect(
      mergeDashboardUrlParams(
        { range: "none", page: "1" },
        { page: "2", metricsUntil: "2026-03-15T12:00:00.000Z" }
      )
    ).toEqual({
      range: "none",
      page: "2",
      metricsUntil: "2026-03-15T12:00:00.000Z",
    });
  });

  it("drops metricsUntil on bounded presets even if present in URL or list params", () => {
    expect(
      mergeDashboardUrlParams(
        { range: "24h", metricsUntil: "2026-03-15T12:00:00.000Z" },
        { page: "2", metricsUntil: "2026-07-18T10:00:00.000Z" }
      )
    ).toEqual({ range: "24h", page: "2" });
  });
});

describe("redirectHrefForMetricsUntil", () => {
  it("adds metricsUntil for open-ended ranges when missing", () => {
    const iso = "2026-03-15T12:00:00.000Z";
    expect(
      redirectHrefForMetricsUntil("/dashboard/overview", { range: "none" }, "none", iso)
    ).toBe(`/dashboard/overview?range=none&metricsUntil=${encodeURIComponent(iso)}`);
  });

  it("returns null when open-ended URL already has metricsUntil", () => {
    expect(
      redirectHrefForMetricsUntil(
        "/dashboard/errors",
        { range: "all", metricsUntil: "2026-03-15T12:00:00.000Z" },
        "all",
        "2026-03-15T12:00:00.000Z"
      )
    ).toBeNull();
  });

  it("strips stale metricsUntil on bounded presets", () => {
    expect(
      redirectHrefForMetricsUntil(
        "/dashboard/overview",
        { range: "24h", metricsUntil: "2026-03-15T12:00:00.000Z", app: "ios" },
        "24h",
        null
      )
    ).toBe("/dashboard/overview?range=24h&app=ios");
  });
});

describe("listTimeRangeHiddenFields", () => {
  it("preserves no-date filter for GET filter forms", () => {
    const range = buildUnselectedTimeRange();
    expect(listTimeRangeHiddenFields(range)).toEqual({ range: "none" });
  });

  it("forwards metricsUntil for open-ended ranges when present", () => {
    const range = buildUnselectedTimeRange();
    const iso = "2026-03-15T12:00:00.000Z";
    expect(listTimeRangeHiddenFields(range, undefined, undefined, iso)).toEqual({
      range: "none",
      metricsUntil: iso,
    });
  });

  it("omits metricsUntil for closed presets", () => {
    const range = buildUnselectedTimeRange();
    const closed = { ...range, key: "24h" as const };
    expect(
      listTimeRangeHiddenFields(closed, undefined, undefined, "2026-03-15T12:00:00.000Z")
    ).toEqual({ range: "24h" });
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
