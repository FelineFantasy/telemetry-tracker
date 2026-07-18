import { describe, expect, it } from "vitest";
import {
  buildDashboardScopedListHref,
  buildErrorGroupDetailHref,
  buildEventListHref,
  formatOverviewDeltaLine,
  resolveScopedQueryValue,
} from "./overview-scope-url";

describe("resolveScopedQueryValue", () => {
  it("returns null for values outside the allow-list", () => {
    expect(resolveScopedQueryValue("staging", ["production"])).toBeNull();
    expect(resolveScopedQueryValue("unknown", [])).toBeNull();
  });

  it("returns trimmed values present in the allow-list", () => {
    expect(resolveScopedQueryValue(" production ", ["production", "staging"])).toBe(
      "production"
    );
  });

  it("returns null for empty input", () => {
    expect(resolveScopedQueryValue("", ["production"])).toBeNull();
    expect(resolveScopedQueryValue(undefined, ["production"])).toBeNull();
  });

  it("always allows the Unknown release sentinel", () => {
    expect(resolveScopedQueryValue("__unknown__", [])).toBe("__unknown__");
    expect(resolveScopedQueryValue("__unknown__", ["1.0.0"])).toBe("__unknown__");
  });
});

describe("buildErrorGroupDetailHref", () => {
  it("includes app and environment scope", () => {
    expect(
      buildErrorGroupDetailHref("eg_1", { app: "web", environment: "production" })
    ).toBe("/dashboard/errors/eg_1?app=web&environment=production");
  });

  it("includes platform and release scope", () => {
    expect(
      buildErrorGroupDetailHref("eg_1", {
        app: "mobile",
        platform: "ios",
        release: "2.1.0",
      })
    ).toBe("/dashboard/errors/eg_1?app=mobile&platform=ios&release=2.1.0");
  });

  it("includes time range for detail drill-down", () => {
    expect(
      buildErrorGroupDetailHref("eg_1", {
        app: "web",
        platform: "ios",
        range: "7d",
      })
    ).toBe("/dashboard/errors/eg_1?app=web&platform=ios&range=7d");
  });
});

describe("buildDashboardScopedListHref", () => {
  it("preserves platform and release in list links", () => {
    expect(
      buildDashboardScopedListHref("/dashboard/events", {
        app: "web",
        environment: "production",
        platform: "web",
        release: "1.0.0",
      })
    ).toBe("/dashboard/events?app=web&environment=production&platform=web&release=1.0.0");
  });

  it("preserves the Unknown release sentinel", () => {
    expect(
      buildDashboardScopedListHref("/dashboard/errors", {
        release: "__unknown__",
        range: "7d",
      })
    ).toBe("/dashboard/errors?release=__unknown__&range=7d");
  });

  it("preserves metricsUntil for open-ended deep links", () => {
    expect(
      buildDashboardScopedListHref("/dashboard/sessions", {
        release: "1.2.0",
        range: "none",
        metricsUntil: "2026-03-15T12:00:00.000Z",
      })
    ).toBe(
      "/dashboard/sessions?release=1.2.0&range=none&metricsUntil=2026-03-15T12%3A00%3A00.000Z"
    );
  });
});

describe("buildEventListHref", () => {
  it("includes event name and scope", () => {
    expect(
      buildEventListHref("screen_view", {
        app: "mobile",
        platform: "android",
      })
    ).toBe("/dashboard/events?name=screen_view&app=mobile&platform=android");
  });
});

describe("formatOverviewDeltaLine", () => {
  it("uses week-ago compare label in stat card copy", () => {
    const line = formatOverviewDeltaLine(3, "errors", "vs same window last week");
    expect(line.text).toBe("+3 vs same window last week");
  });

  it("uses previous-period baseline for zero delta", () => {
    const line = formatOverviewDeltaLine(0, "events", "vs previous 7 days");
    expect(line.text).toBe("Same as previous 7 days");
  });
});
