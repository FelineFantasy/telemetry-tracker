import { describe, expect, it } from "vitest";
import { healthStatusFromCounts } from "./project-nav-summary.js";

describe("project nav health status", () => {
  it("returns idle when no telemetry", () => {
    expect(healthStatusFromCounts(0, 0)).toBe("idle");
  });

  it("returns operational below 1% error rate", () => {
    expect(healthStatusFromCounts(1000, 9)).toBe("operational");
  });

  it("returns degraded between 1% and 5%", () => {
    expect(healthStatusFromCounts(100, 2)).toBe("degraded");
  });

  it("returns outage at or above 5%", () => {
    expect(healthStatusFromCounts(100, 6)).toBe("outage");
  });
});
