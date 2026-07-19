/** Overview Performance card helpers — Web Vitals snapshot (#197). */

import { rateWebVital, type WebVitalRating } from "@telemetry-tracker/core";
import {
  scopeForPerformanceEventsDrillDown,
  type DashboardListScope,
} from "@/lib/overview-scope-url";
import type {
  PerformancePageSummary,
  WebVitalMetricSummary,
} from "@/lib/performance-summary";

export const OVERVIEW_VITAL_ORDER = ["LCP", "INP", "CLS", "TTFB"] as const;

export type OverviewVitalKey = (typeof OVERVIEW_VITAL_ORDER)[number];

export const OVERVIEW_VITAL_LABELS: Record<OverviewVitalKey, string> = {
  LCP: "LCP",
  INP: "INP / FID",
  CLS: "CLS",
  TTFB: "TTFB",
};

export type OverviewVitalRatingLabel = "Good" | "Needs improvement" | "Poor";

export type OverviewVitalBadgeTone = "success" | "warning" | "destructive";

export type OverviewVitalRow = {
  metric: OverviewVitalKey;
  label: string;
  /** Formatted p75, or null when insufficient samples. */
  valueDisplay: string | null;
  /** Classification of p75; null when no value to rate. */
  rating: WebVitalRating | null;
  ratingLabel: OverviewVitalRatingLabel | null;
  badgeTone: OverviewVitalBadgeTone | null;
  sampleCount: number;
  ratingDistribution: WebVitalMetricSummary["rating"];
};

export type OverviewMetricsWindow = {
  since: string;
  until: string;
};

const RATING_LABELS: Record<WebVitalRating, OverviewVitalRatingLabel> = {
  good: "Good",
  "needs-improvement": "Needs improvement",
  poor: "Poor",
};

const RATING_TONES: Record<WebVitalRating, OverviewVitalBadgeTone> = {
  good: "success",
  "needs-improvement": "warning",
  poor: "destructive",
};

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Format a vital p75 for display; null → insufficient data placeholder. */
export function formatOverviewVitalP75(
  metric: OverviewVitalKey,
  value: number | null
): string | null {
  if (value == null) return null;
  if (metric === "CLS") return value.toFixed(3);
  return formatDurationMs(value);
}

/**
 * Classify a vital p75 using standard Web Vitals thresholds.
 * FID samples are aggregated as INP server-side; classify with INP bands.
 */
export function classifyOverviewVitalP75(
  metric: OverviewVitalKey,
  p75: number | null
): WebVitalRating | null {
  if (p75 == null || !Number.isFinite(p75)) return null;
  return rateWebVital(metric, p75);
}

export function overviewVitalRatingLabel(
  rating: WebVitalRating | null
): OverviewVitalRatingLabel | null {
  return rating ? RATING_LABELS[rating] : null;
}

export function overviewVitalBadgeTone(
  rating: WebVitalRating | null
): OverviewVitalBadgeTone | null {
  return rating ? RATING_TONES[rating] : null;
}

/**
 * Align Performance card + View report with Overview's resolved KPI window.
 *
 * Calendar/custom compare (#495) replace the current metrics window (e.g.
 * `compare=week` → "This week"). Performance summary ignores Overview's
 * compare semantics unless we either forward compare* or express the resolved
 * window as `range=custom&from&to`. Match Performance→Events drill-downs:
 * convert the resolved window and drop compare*.
 */
export function resolveOverviewPerformanceScope(
  listScope: DashboardListScope,
  metricsWindow?: OverviewMetricsWindow | null
): DashboardListScope {
  if (metricsWindow?.since && metricsWindow?.until) {
    return scopeForPerformanceEventsDrillDown(listScope, metricsWindow);
  }
  return overviewPerformanceReportScope(listScope);
}

/** Build `GET /api/performance/summary` query from a resolved Performance scope. */
export function buildOverviewPerformanceSummaryQuery(
  scope: DashboardListScope
): URLSearchParams {
  const params = new URLSearchParams();
  if (scope.app) params.set("app", scope.app);
  if (scope.environment) params.set("environment", scope.environment);
  if (scope.platform) params.set("platform", scope.platform);
  if (scope.release) params.set("release", scope.release);
  if (scope.range) params.set("range", scope.range);
  if (scope.from) params.set("from", scope.from);
  if (scope.to) params.set("to", scope.to);
  if (scope.metricsUntil) params.set("metricsUntil", scope.metricsUntil);
  return params;
}

/**
 * Scope for Performance `View report →` when no resolved metrics window is
 * provided — keep page range filters, omit compare* (card is a snapshot).
 */
export function overviewPerformanceReportScope(
  listScope: DashboardListScope
): DashboardListScope {
  return {
    app: listScope.app,
    environment: listScope.environment,
    platform: listScope.platform,
    release: listScope.release,
    range: listScope.range,
    from: listScope.from,
    to: listScope.to,
    metricsUntil: listScope.metricsUntil,
  };
}

export function hasOverviewWebVitals(
  summary: PerformancePageSummary | null | undefined
): boolean {
  return summary?.webVitals.available === true;
}

/** Map API vitals into Overview card rows with explicit empty placeholders. */
export function mapOverviewVitalRows(
  summary: PerformancePageSummary
): OverviewVitalRow[] {
  return OVERVIEW_VITAL_ORDER.map((metric) => {
    const vital = summary.webVitals.vitals[metric];
    const rating = classifyOverviewVitalP75(metric, vital.p75);
    return {
      metric,
      label: OVERVIEW_VITAL_LABELS[metric],
      valueDisplay: formatOverviewVitalP75(metric, vital.p75),
      rating,
      ratingLabel: overviewVitalRatingLabel(rating),
      badgeTone: overviewVitalBadgeTone(rating),
      sampleCount: vital.sampleCount,
      ratingDistribution: vital.rating,
    };
  });
}
