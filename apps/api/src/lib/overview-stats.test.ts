import { describe, expect, it } from "vitest";
import { computeOverviewHealth } from "./overview-stats.js";

describe("computeOverviewHealth", () => {
  it("marks operational when error rate is low", () => {
    const h = computeOverviewHealth(1000, 5, 900, 10, [
      { t: "2026-01-01T00:00:00.000Z", count: 3600 },
    ]);
    expect(h.status).toBe("operational");
    expect(h.successRatePct).toBeGreaterThan(99);
  });

  it("marks outage when error rate is high", () => {
    const h = computeOverviewHealth(100, 900, 100, 100, [
      { t: "2026-01-01T00:00:00.000Z", count: 100 },
    ]);
    expect(h.status).toBe("outage");
  });
});
