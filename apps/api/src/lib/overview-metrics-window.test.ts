import { describe, expect, it } from "vitest";
import {
  UNSELECTED_METRICS_FALLBACK_MS,
  UNSELECTED_METRICS_MAX_MS,
  UNSELECTED_METRICS_MIN_MS,
  buildFallbackUnselectedMetricsWindow,
  buildMetricsWindowFromDuration,
  clampUnselectedMetricsDurationMs,
} from "./overview-metrics-window.js";

describe("clampUnselectedMetricsDurationMs", () => {
  it("uses fallback when there is no data span", () => {
    expect(clampUnselectedMetricsDurationMs(null)).toBe(UNSELECTED_METRICS_FALLBACK_MS);
    expect(clampUnselectedMetricsDurationMs(0)).toBe(UNSELECTED_METRICS_FALLBACK_MS);
  });

  it("enforces minimum window for very recent bursts", () => {
    expect(clampUnselectedMetricsDurationMs(60_000)).toBe(UNSELECTED_METRICS_MIN_MS);
  });

  it("uses the actual span inside min/max bounds", () => {
    const span = 14 * 24 * 60 * 60 * 1000;
    expect(clampUnselectedMetricsDurationMs(span)).toBe(span);
  });

  it("caps wide spans at the maximum window", () => {
    expect(clampUnselectedMetricsDurationMs(365 * 24 * 60 * 60 * 1000)).toBe(
      UNSELECTED_METRICS_MAX_MS
    );
  });
});

describe("buildMetricsWindowFromDuration", () => {
  const until = new Date("2026-06-28T12:00:00.000Z");

  it("anchors on until", () => {
    const window = buildMetricsWindowFromDuration(until, UNSELECTED_METRICS_FALLBACK_MS);
    expect(window.lte).toEqual(until);
    expect(window.durationMs).toBe(UNSELECTED_METRICS_FALLBACK_MS);
    expect(window.gte.getTime()).toBe(until.getTime() - UNSELECTED_METRICS_FALLBACK_MS);
  });
});

describe("buildFallbackUnselectedMetricsWindow", () => {
  it("returns a 30-day window ending at now", () => {
    const until = new Date("2026-06-28T12:00:00.000Z");
    const window = buildFallbackUnselectedMetricsWindow(until);
    expect(window.durationMs).toBe(UNSELECTED_METRICS_FALLBACK_MS);
    expect(window.lte).toEqual(until);
  });
});
