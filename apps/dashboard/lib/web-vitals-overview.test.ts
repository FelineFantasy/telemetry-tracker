import { describe, expect, it } from "vitest";
import type { PerformancePageSummary, WebVitalMetricSummary } from "./performance-summary";
import {
  buildOverviewPerformanceSummaryQuery,
  classifyOverviewVitalP75,
  formatOverviewVitalP75,
  hasOverviewWebVitals,
  mapOverviewVitalRows,
  overviewPerformanceReportScope,
  overviewVitalBadgeTone,
  overviewVitalRatingLabel,
  resolveOverviewPerformanceScope,
} from "./web-vitals-overview";
import { buildDashboardScopedListHref } from "./overview-scope-url";

function emptyRating(): WebVitalMetricSummary["rating"] {
  return {
    good: 0,
    needsImprovement: 0,
    poor: 0,
    goodPct: 0,
    needsImprovementPct: 0,
    poorPct: 0,
    total: 0,
  };
}

function vital(
  metric: WebVitalMetricSummary["metric"],
  overrides: Partial<WebVitalMetricSummary> = {}
): WebVitalMetricSummary {
  return {
    metric,
    sampleCount: 0,
    p75: null,
    p75Previous: null,
    p95: null,
    goodPctPrevious: null,
    rating: emptyRating(),
    series: [],
    ...overrides,
  };
}

function summary(
  overrides: Partial<PerformancePageSummary["webVitals"]> = {}
): PerformancePageSummary {
  return {
    window: {
      since: "2026-01-01T00:00:00.000Z",
      until: "2026-01-08T00:00:00.000Z",
      label: "Last 7 days",
      compareLabel: "vs prior 7 days",
    },
    chartWindow: {
      since: "2026-01-01T00:00:00.000Z",
      until: "2026-01-08T00:00:00.000Z",
    },
    bucket: "day",
    webVitals: {
      available: false,
      vitals: {
        LCP: vital("LCP"),
        INP: vital("INP"),
        CLS: vital("CLS"),
        TTFB: vital("TTFB"),
      },
      ...overrides,
    },
    requestLatency: { available: false },
  };
}

describe("formatOverviewVitalP75", () => {
  it("returns null for missing values", () => {
    expect(formatOverviewVitalP75("LCP", null)).toBeNull();
  });

  it("formats duration and CLS", () => {
    expect(formatOverviewVitalP75("LCP", 900)).toBe("900ms");
    expect(formatOverviewVitalP75("LCP", 1800)).toBe("1.80s");
    expect(formatOverviewVitalP75("LCP", 2500)).toBe("2.50s");
    expect(formatOverviewVitalP75("CLS", 0.085)).toBe("0.085");
  });
});

describe("classifyOverviewVitalP75", () => {
  it("returns null when p75 is missing", () => {
    expect(classifyOverviewVitalP75("LCP", null)).toBeNull();
  });

  it("classifies LCP / INP / CLS / TTFB with standard thresholds", () => {
    expect(classifyOverviewVitalP75("LCP", 2000)).toBe("good");
    expect(classifyOverviewVitalP75("LCP", 3000)).toBe("needs-improvement");
    expect(classifyOverviewVitalP75("LCP", 4500)).toBe("poor");

    expect(classifyOverviewVitalP75("INP", 150)).toBe("good");
    expect(classifyOverviewVitalP75("INP", 350)).toBe("needs-improvement");
    expect(classifyOverviewVitalP75("INP", 600)).toBe("poor");

    expect(classifyOverviewVitalP75("CLS", 0.05)).toBe("good");
    expect(classifyOverviewVitalP75("CLS", 0.15)).toBe("needs-improvement");
    expect(classifyOverviewVitalP75("CLS", 0.3)).toBe("poor");

    expect(classifyOverviewVitalP75("TTFB", 500)).toBe("good");
    expect(classifyOverviewVitalP75("TTFB", 1200)).toBe("needs-improvement");
    expect(classifyOverviewVitalP75("TTFB", 2000)).toBe("poor");
  });
});

describe("overviewVitalRatingLabel / overviewVitalBadgeTone", () => {
  it("maps ratings to display labels and badge tones", () => {
    expect(overviewVitalRatingLabel("good")).toBe("Good");
    expect(overviewVitalRatingLabel("needs-improvement")).toBe("Needs improvement");
    expect(overviewVitalRatingLabel("poor")).toBe("Poor");
    expect(overviewVitalRatingLabel(null)).toBeNull();

    expect(overviewVitalBadgeTone("good")).toBe("success");
    expect(overviewVitalBadgeTone("needs-improvement")).toBe("warning");
    expect(overviewVitalBadgeTone("poor")).toBe("destructive");
    expect(overviewVitalBadgeTone(null)).toBeNull();
  });
});

describe("buildOverviewPerformanceSummaryQuery", () => {
  it("forwards page-range scope without compare params", () => {
    const params = buildOverviewPerformanceSummaryQuery({
      app: "web",
      environment: "production",
      platform: "browser",
      release: "1.2.0",
      range: "7d",
      metricsUntil: "2026-07-19T12:00:00.000Z",
      compare: "week",
      compareFrom: "2026-07-01T00:00:00.000Z",
      compareTo: "2026-07-08T00:00:00.000Z",
    });
    expect(params.get("app")).toBe("web");
    expect(params.get("environment")).toBe("production");
    expect(params.get("platform")).toBe("browser");
    expect(params.get("release")).toBe("1.2.0");
    expect(params.get("range")).toBe("7d");
    expect(params.get("metricsUntil")).toBe("2026-07-19T12:00:00.000Z");
    expect(params.get("compare")).toBeNull();
    expect(params.get("compareFrom")).toBeNull();
    expect(params.get("compareTo")).toBeNull();
  });

  it("includes absolute from/to when present", () => {
    const params = buildOverviewPerformanceSummaryQuery({
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-08T00:00:00.000Z",
    });
    expect(params.get("from")).toBe("2026-07-01T00:00:00.000Z");
    expect(params.get("to")).toBe("2026-07-08T00:00:00.000Z");
  });
});

describe("resolveOverviewPerformanceScope", () => {
  const listScope = {
    app: "web",
    environment: "production",
    platform: "browser",
    release: "1.2.0",
    range: "7d",
    compare: "week" as const,
  };

  it("maps compare=week resolved KPI window to custom from/to and drops compare", () => {
    const scope = resolveOverviewPerformanceScope(listScope, {
      since: "2026-07-13T00:00:00.000Z",
      until: "2026-07-19T15:30:00.000Z",
    });
    expect(scope).toEqual({
      app: "web",
      environment: "production",
      platform: "browser",
      release: "1.2.0",
      range: "custom",
      from: "2026-07-13T00:00:00.000Z",
      to: "2026-07-19T15:30:00.000Z",
    });
    const params = buildOverviewPerformanceSummaryQuery(scope);
    expect(params.get("range")).toBe("custom");
    expect(params.get("from")).toBe("2026-07-13T00:00:00.000Z");
    expect(params.get("to")).toBe("2026-07-19T15:30:00.000Z");
    expect(params.get("compare")).toBeNull();
    expect(
      buildDashboardScopedListHref("/dashboard/performance", scope)
    ).toBe(
      "/dashboard/performance?app=web&environment=production&platform=browser&release=1.2.0&range=custom&from=2026-07-13T00%3A00%3A00.000Z&to=2026-07-19T15%3A30%3A00.000Z"
    );
  });

  it("maps custom comparison current window to custom from/to and drops compareFrom/To", () => {
    const scope = resolveOverviewPerformanceScope(
      {
        app: "api",
        range: "custom",
        from: "2026-07-10T00:00:00.000Z",
        to: "2026-07-17T00:00:00.000Z",
        compare: "custom",
        compareFrom: "2026-07-03T00:00:00.000Z",
        compareTo: "2026-07-10T00:00:00.000Z",
      },
      {
        since: "2026-07-10T00:00:00.000Z",
        until: "2026-07-17T00:00:00.000Z",
      }
    );
    expect(scope).toEqual({
      app: "api",
      environment: undefined,
      platform: undefined,
      release: undefined,
      range: "custom",
      from: "2026-07-10T00:00:00.000Z",
      to: "2026-07-17T00:00:00.000Z",
    });
    const params = buildOverviewPerformanceSummaryQuery(scope);
    expect(params.get("range")).toBe("custom");
    expect(params.get("from")).toBe("2026-07-10T00:00:00.000Z");
    expect(params.get("to")).toBe("2026-07-17T00:00:00.000Z");
    expect(params.get("compare")).toBeNull();
    expect(params.get("compareFrom")).toBeNull();
    expect(params.get("compareTo")).toBeNull();
    expect(
      buildDashboardScopedListHref("/dashboard/performance", scope)
    ).toBe(
      "/dashboard/performance?app=api&range=custom&from=2026-07-10T00%3A00%3A00.000Z&to=2026-07-17T00%3A00%3A00.000Z"
    );
  });

  it("maps rolling/default 7d KPI window to custom from/to (not list range=7d)", () => {
    const scope = resolveOverviewPerformanceScope(
      {
        app: "web",
        environment: "production",
        range: "7d",
        compare: "previous",
      },
      {
        since: "2026-07-12T12:00:00.000Z",
        until: "2026-07-19T12:00:00.000Z",
      }
    );
    expect(scope).toEqual({
      app: "web",
      environment: "production",
      platform: undefined,
      release: undefined,
      range: "custom",
      from: "2026-07-12T12:00:00.000Z",
      to: "2026-07-19T12:00:00.000Z",
    });
    expect(scope.range).not.toBe("7d");
    const params = buildOverviewPerformanceSummaryQuery(scope);
    expect(params.get("range")).toBe("custom");
    expect(params.get("from")).toBe("2026-07-12T12:00:00.000Z");
    expect(params.get("to")).toBe("2026-07-19T12:00:00.000Z");
    expect(params.get("compare")).toBeNull();
    expect(
      buildDashboardScopedListHref("/dashboard/performance", scope)
    ).toBe(
      "/dashboard/performance?app=web&environment=production&range=custom&from=2026-07-12T12%3A00%3A00.000Z&to=2026-07-19T12%3A00%3A00.000Z"
    );
  });

  it("falls back to page-range scope (no compare) when metrics window is absent", () => {
    expect(resolveOverviewPerformanceScope(listScope, null)).toEqual({
      app: "web",
      environment: "production",
      platform: "browser",
      release: "1.2.0",
      range: "7d",
      from: undefined,
      to: undefined,
      metricsUntil: undefined,
    });
  });
});

describe("overviewPerformanceReportScope", () => {
  it("strips compare params so View report matches the card window", () => {
    expect(
      overviewPerformanceReportScope({
        app: "web",
        environment: "production",
        range: "7d",
        compare: "week",
        compareFrom: "2026-07-01T00:00:00.000Z",
        compareTo: "2026-07-08T00:00:00.000Z",
      })
    ).toEqual({
      app: "web",
      environment: "production",
      platform: undefined,
      release: undefined,
      range: "7d",
      from: undefined,
      to: undefined,
      metricsUntil: undefined,
    });
  });
});

describe("hasOverviewWebVitals treats fetch failure separately from empty", () => {
  it("returns false for null (caller should show load error, not empty SDK copy)", () => {
    expect(hasOverviewWebVitals(null)).toBe(false);
  });
});

describe("hasOverviewWebVitals / mapOverviewVitalRows", () => {
  it("treats null and unavailable summaries as empty", () => {
    expect(hasOverviewWebVitals(null)).toBe(false);
    expect(hasOverviewWebVitals(undefined)).toBe(false);
    expect(hasOverviewWebVitals(summary())).toBe(false);
  });

  it("maps available vitals with classification and placeholders for missing metrics", () => {
    const data = summary({
      available: true,
      vitals: {
        LCP: vital("LCP", {
          sampleCount: 40,
          p75: 1800,
          rating: {
            good: 30,
            needsImprovement: 8,
            poor: 2,
            goodPct: 75,
            needsImprovementPct: 20,
            poorPct: 5,
            total: 40,
          },
        }),
        INP: vital("INP", {
          sampleCount: 20,
          p75: 350,
          rating: {
            good: 5,
            needsImprovement: 10,
            poor: 5,
            goodPct: 25,
            needsImprovementPct: 50,
            poorPct: 25,
            total: 20,
          },
        }),
        CLS: vital("CLS"),
        TTFB: vital("TTFB", {
          sampleCount: 10,
          p75: 2000,
          rating: {
            good: 1,
            needsImprovement: 2,
            poor: 7,
            goodPct: 10,
            needsImprovementPct: 20,
            poorPct: 70,
            total: 10,
          },
        }),
      },
    });

    expect(hasOverviewWebVitals(data)).toBe(true);
    const rows = mapOverviewVitalRows(data);
    expect(rows).toHaveLength(4);

    expect(rows[0]).toMatchObject({
      metric: "LCP",
      label: "LCP",
      valueDisplay: "1.80s",
      rating: "good",
      ratingLabel: "Good",
      badgeTone: "success",
      sampleCount: 40,
    });
    expect(rows[1]).toMatchObject({
      metric: "INP",
      label: "INP / FID",
      valueDisplay: "350ms",
      rating: "needs-improvement",
      ratingLabel: "Needs improvement",
      badgeTone: "warning",
    });
    expect(rows[2]).toMatchObject({
      metric: "CLS",
      valueDisplay: null,
      rating: null,
      ratingLabel: null,
      badgeTone: null,
      sampleCount: 0,
    });
    expect(rows[3]).toMatchObject({
      metric: "TTFB",
      valueDisplay: "2.00s",
      rating: "poor",
      ratingLabel: "Poor",
      badgeTone: "destructive",
    });
  });
});
