import { Prisma } from "@prisma/client";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildPerformanceFilter,
  buildWebVitalRatingDistribution,
  mergeVitalSeriesBuckets,
  normalizeWebVitalMetric,
  parsePerformanceMetricsAnchor,
  pctOfTotal,
  resolvePerformanceSummaryWindow,
  roundWebVitalValue,
  WEB_VITAL_EVENT_NAME,
  WEB_VITAL_THRESHOLDS,
  webVitalMetricKeySql,
  webVitalComputedRatingSql,
  webVitalValueExpr,
} from "./performance-page-summary.js";

function prismaSqlText(fragment: Prisma.Sql): string {
  return fragment.strings.reduce(
    (acc, part, i) => acc + part + (fragment.values[i] ?? ""),
    ""
  );
}

describe("WEB_VITAL_EVENT_NAME", () => {
  it("matches SDK auto-captured event name", () => {
    expect(WEB_VITAL_EVENT_NAME).toBe("$web_vital");
  });
});

describe("normalizeWebVitalMetric", () => {
  it("maps FID samples into INP", () => {
    expect(normalizeWebVitalMetric("FID")).toBe("INP");
    expect(normalizeWebVitalMetric("inp")).toBe("INP");
  });

  it("accepts core vitals and rejects unknown metrics", () => {
    expect(normalizeWebVitalMetric("LCP")).toBe("LCP");
    expect(normalizeWebVitalMetric("CLS")).toBe("CLS");
    expect(normalizeWebVitalMetric("TTFB")).toBe("TTFB");
    expect(normalizeWebVitalMetric("FCP")).toBeNull();
    expect(normalizeWebVitalMetric(undefined)).toBeNull();
  });
});

describe("WEB_VITAL_THRESHOLDS", () => {
  it("aligns with Google Web Vitals bands", () => {
    expect(WEB_VITAL_THRESHOLDS.LCP).toEqual({ goodMax: 2500, poorMin: 4000 });
    expect(WEB_VITAL_THRESHOLDS.INP).toEqual({ goodMax: 200, poorMin: 500 });
    expect(WEB_VITAL_THRESHOLDS.CLS).toEqual({ goodMax: 0.1, poorMin: 0.25 });
    expect(WEB_VITAL_THRESHOLDS.TTFB).toEqual({ goodMax: 800, poorMin: 1800 });
  });
});

describe("parsePerformanceMetricsAnchor", () => {
  it("parses ISO metricsUntil", () => {
    const iso = "2026-06-28T12:00:00.000Z";
    expect(parsePerformanceMetricsAnchor(iso).toISOString()).toBe(iso);
  });

  it("falls back to now when metricsUntil is missing or invalid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T12:00:00.000Z"));
    expect(parsePerformanceMetricsAnchor(undefined).toISOString()).toBe(
      "2026-06-28T12:00:00.000Z"
    );
    expect(parsePerformanceMetricsAnchor("bad-date").toISOString()).toBe(
      "2026-06-28T12:00:00.000Z"
    );
    vi.useRealTimers();
  });
});

describe("resolvePerformanceSummaryWindow", () => {
  const anchor = new Date("2026-06-28T12:00:00.000Z");
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to last 7 days when range has no lower bound", () => {
    vi.useFakeTimers();
    vi.setSystemTime(anchor);
    const until = new Date("2026-06-28T00:00:00.000Z");
    const w = resolvePerformanceSummaryWindow({ lte: until }, anchor);

    expect(w.label).toBe("Last 7 days");
    expect(w.until.getTime()).toBe(until.getTime());
    expect(w.since.getTime()).toBe(until.getTime() - sevenDaysMs);
    expect(w.compareLabel).toBe("vs prior period");
    vi.useRealTimers();
  });

  it("uses explicit range bounds and selected-period label", () => {
    const since = new Date("2026-06-01T00:00:00.000Z");
    const until = new Date("2026-06-08T00:00:00.000Z");
    const w = resolvePerformanceSummaryWindow({ gte: since, lte: until }, anchor);

    expect(w.label).toBe("Selected period");
    expect(w.since).toEqual(since);
    expect(w.until).toEqual(until);
  });
});

describe("buildPerformanceFilter", () => {
  it("includes optional scope fields when provided", () => {
    const range = {
      gte: new Date("2026-06-01T00:00:00.000Z"),
      lte: new Date("2026-06-08T00:00:00.000Z"),
    };
    expect(
      buildPerformanceFilter({
        appId: "web",
        platform: "browser",
        environment: "production",
        release: "1.2.3",
        range,
      })
    ).toEqual({
      appId: "web",
      platform: "browser",
      environment: "production",
      release: "1.2.3",
      range,
    });
  });
});

describe("pctOfTotal", () => {
  it("returns 0 when total is zero", () => {
    expect(pctOfTotal(5, 0)).toBe(0);
  });

  it("computes percentage share", () => {
    expect(pctOfTotal(25, 100)).toBe(25);
  });
});

describe("buildWebVitalRatingDistribution", () => {
  it("returns counts and percentages that sum to 100%", () => {
    const dist = buildWebVitalRatingDistribution(70, 20, 10);
    expect(dist.total).toBe(100);
    expect(dist.good).toBe(70);
    expect(dist.needsImprovement).toBe(20);
    expect(dist.poor).toBe(10);
    expect(dist.goodPct).toBe(70);
    expect(dist.needsImprovementPct).toBe(20);
    expect(dist.poorPct).toBe(10);
  });
});

describe("roundWebVitalValue", () => {
  it("rounds latency vitals to whole milliseconds", () => {
    expect(roundWebVitalValue("LCP", 1234.6)).toBe(1235);
    expect(roundWebVitalValue("INP", 88.2)).toBe(88);
  });

  it("keeps three decimal places for CLS", () => {
    expect(roundWebVitalValue("CLS", 0.12349)).toBe(0.123);
  });

  it("returns null for invalid values", () => {
    expect(roundWebVitalValue("TTFB", null)).toBeNull();
    expect(roundWebVitalValue("TTFB", Number.NaN)).toBeNull();
  });
});

describe("mergeVitalSeriesBuckets", () => {
  it("zero-fills missing buckets with null values", () => {
    const buckets = [
      new Date("2026-06-01T00:00:00.000Z"),
      new Date("2026-06-02T00:00:00.000Z"),
    ];
    const series = mergeVitalSeriesBuckets(
      buckets,
      [
        {
          bucket: buckets[0]!,
          p75: 2100,
          sampleCount: 4,
        },
      ],
      "LCP"
    );
    expect(series).toEqual([
      { t: buckets[0]!.toISOString(), value: 2100 },
      { t: buckets[1]!.toISOString(), value: null },
    ]);
  });

  it("returns null when a bucket has no samples", () => {
    const bucket = new Date("2026-06-01T00:00:00.000Z");
    const series = mergeVitalSeriesBuckets(
      [bucket],
      [{ bucket, p75: 100, sampleCount: 0 }],
      "INP"
    );
    expect(series[0]?.value).toBeNull();
  });
});

describe("web vital SQL helpers", () => {
  it("extracts numeric value from properties JSON", () => {
    const text = prismaSqlText(webVitalValueExpr("e"));
    expect(text).toContain("properties");
    expect(text).toContain("value");
  });

  it("groups FID into INP for aggregation", () => {
    const text = prismaSqlText(webVitalMetricKeySql("e"));
    expect(text).toContain("'INP'");
    expect(text).toContain("'FID'");
  });

  it("computes rating bands from value thresholds (FID uses INP bands)", () => {
    const metricKey = webVitalMetricKeySql("e");
    const value = webVitalValueExpr("e");
    const text = prismaSqlText(webVitalComputedRatingSql(metricKey, value));
    expect(text).toContain("'needs-improvement'");
    expect(text).toContain("'good'");
    expect(text).toContain("'poor'");
  });
});
