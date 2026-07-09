import { describe, expect, it } from "vitest";
import { rateWebVital, buildWebVitalProperties } from "./web-vitals.js";
import type { Metric } from "web-vitals";

describe("rateWebVital", () => {
  it("rates LCP against Google thresholds", () => {
    expect(rateWebVital("LCP", 2000)).toBe("good");
    expect(rateWebVital("LCP", 3000)).toBe("needs-improvement");
    expect(rateWebVital("LCP", 5000)).toBe("poor");
  });

  it("rates CLS against Google thresholds", () => {
    expect(rateWebVital("CLS", 0.05)).toBe("good");
    expect(rateWebVital("CLS", 0.15)).toBe("needs-improvement");
    expect(rateWebVital("CLS", 0.3)).toBe("poor");
  });

  it("rates INP against Google thresholds", () => {
    expect(rateWebVital("INP", 150)).toBe("good");
    expect(rateWebVital("INP", 350)).toBe("needs-improvement");
    expect(rateWebVital("INP", 600)).toBe("poor");
  });
});

describe("buildWebVitalProperties", () => {
  it("maps web-vitals Metric to ingest properties", () => {
    const metric = {
      name: "LCP",
      value: 2100,
      rating: "good",
      delta: 2100,
      id: "v3-123",
      navigationType: "navigate",
    } as Metric;

    const props = buildWebVitalProperties(metric);
    expect(props.metric).toBe("LCP");
    expect(props.value).toBe(2100);
    expect(props.rating).toBe("good");
    expect(props.id).toBe("v3-123");
    expect(props.navigation_type).toBe("navigate");
    expect(typeof props.path).toBe("string");
  });
});
