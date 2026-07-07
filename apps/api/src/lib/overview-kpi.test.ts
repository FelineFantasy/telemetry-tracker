import { describe, expect, it } from "vitest";
import {
  apdexPctFromScore,
  apdexScore,
  overviewTopErrorGroupWhere,
  REQUEST_APDEX_THRESHOLD_MS,
  sparklinesFromTimeSeries,
} from "./overview-kpi.js";

describe("apdexScore", () => {
  it("returns 1 when there are no samples", () => {
    expect(apdexScore(0, 0, 0)).toBe(1);
  });

  it("weights tolerating samples at half value", () => {
    expect(apdexScore(8, 2, 10)).toBe(0.9);
  });

  it("returns 0 when every sample is frustrated", () => {
    expect(apdexScore(0, 0, 5)).toBe(0);
  });
});

describe("apdexPctFromScore", () => {
  it("rounds to one decimal place as a percentage", () => {
    expect(apdexPctFromScore(0.91234)).toBe(91.2);
  });
});

describe("sparklinesFromTimeSeries", () => {
  it("passes through errors, events, and sessions series", () => {
    const point = { t: "2026-06-01T00:00:00.000Z", count: 3 };
    expect(
      sparklinesFromTimeSeries({
        errors: [point],
        events: [{ ...point, count: 5 }],
        sessions: [{ ...point, count: 2 }],
      })
    ).toEqual({
      errors: [point],
      events: [{ t: point.t, count: 5 }],
      sessions: [{ t: point.t, count: 2 }],
    });
  });
});

describe("REQUEST_APDEX_THRESHOLD_MS", () => {
  it("uses a 300ms satisfied threshold for Node request events", () => {
    expect(REQUEST_APDEX_THRESHOLD_MS).toBe(300);
  });
});

describe("overviewTopErrorGroupWhere", () => {
  it("scopes top error groups to the metrics window", () => {
    const since = new Date("2026-03-01T00:00:00.000Z");
    const until = new Date("2026-03-15T00:00:00.000Z");
    const where = overviewTopErrorGroupWhere(
      "proj_1",
      { app: "web", environment: "production" },
      { gte: since, lte: until }
    );

    expect(where).toMatchObject({
      project_id: "proj_1",
      app: "web",
      environment: "production",
      last_seen: { gte: since, lte: until },
    });
  });
});
