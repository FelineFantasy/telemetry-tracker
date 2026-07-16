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
