import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Metric } from "web-vitals";

const metricHandlers: Record<string, (metric: Metric) => void> = {};

vi.mock("web-vitals", () => ({
  onCLS: (fn: (metric: Metric) => void) => {
    metricHandlers.CLS = fn;
  },
  onINP: (fn: (metric: Metric) => void) => {
    metricHandlers.INP = fn;
  },
  onLCP: (fn: (metric: Metric) => void) => {
    metricHandlers.LCP = fn;
  },
  onTTFB: (fn: (metric: Metric) => void) => {
    metricHandlers.TTFB = fn;
  },
}));

describe("installWebVitals capture gating", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const key of Object.keys(metricHandlers)) {
      delete metricHandlers[key];
    }
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      location: { pathname: "/test" },
    });
    vi.stubGlobal("document", { addEventListener: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const sampleMetric = {
    name: "CLS",
    value: 0.05,
    rating: "good",
    delta: 0.05,
    id: "v3-test",
    navigationType: "navigate",
  } as Metric;

  it("does not report when capture is disabled before handlers register", async () => {
    const {
      installWebVitals,
      setWebVitalsCaptureEnabled,
      resetWebVitalsInstallState,
    } = await import("./web-vitals.js");

    resetWebVitalsInstallState();
    setWebVitalsCaptureEnabled(false);
    const report = vi.fn();
    installWebVitals(report);
    await Promise.resolve();
    await Promise.resolve();

    expect(metricHandlers.CLS).toBeUndefined();
    expect(report).not.toHaveBeenCalled();
  });

  it("stops reporting after setWebVitalsCaptureEnabled(false)", async () => {
    const {
      installWebVitals,
      setWebVitalsCaptureEnabled,
      resetWebVitalsInstallState,
    } = await import("./web-vitals.js");

    resetWebVitalsInstallState();
    setWebVitalsCaptureEnabled(true);
    const report = vi.fn();
    installWebVitals(report);
    await vi.waitFor(() => expect(metricHandlers.CLS).toBeDefined());

    metricHandlers.CLS?.(sampleMetric);
    expect(report).toHaveBeenCalledTimes(1);

    setWebVitalsCaptureEnabled(false);
    metricHandlers.CLS?.(sampleMetric);
    expect(report).toHaveBeenCalledTimes(1);
  });
});
