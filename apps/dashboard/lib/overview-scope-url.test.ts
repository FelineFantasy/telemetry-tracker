import { describe, expect, it } from "vitest";
import {
  buildDashboardNavTabHref,
  buildDashboardScopedListHref,
  buildErrorGroupDetailHref,
  buildEventListHref,
  buildSlowPageSessionsHref,
  buildSlowPageWebVitalEventsHref,
  buildSlowRouteEventsHref,
  formatOverviewDeltaLine,
  isRollingCompareParam,
  resolveScopedQueryValue,
} from "./overview-scope-url";

describe("isRollingCompareParam", () => {
  it("treats previous and week-ago as rolling", () => {
    expect(isRollingCompareParam("previous")).toBe(true);
    expect(isRollingCompareParam("week-ago")).toBe(true);
  });

  it("treats calendar and custom as non-rolling", () => {
    expect(isRollingCompareParam("today-yesterday")).toBe(false);
    expect(isRollingCompareParam("week")).toBe(false);
    expect(isRollingCompareParam("month")).toBe(false);
    expect(isRollingCompareParam("custom")).toBe(false);
  });
});

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

  it("includes metricsUntil for open-ended detail deep links", () => {
    expect(
      buildErrorGroupDetailHref("eg_1", {
        app: "web",
        range: "none",
        metricsUntil: "2026-03-15T12:00:00.000Z",
      })
    ).toBe(
      "/dashboard/errors/eg_1?app=web&range=none&metricsUntil=2026-03-15T12%3A00%3A00.000Z"
    );
  });

  it("includes metricsSince with metricsUntil for Overview exact-window deep links", () => {
    expect(
      buildErrorGroupDetailHref("eg_1", {
        app: "web",
        range: "none",
        metricsSince: "2026-03-08T12:00:00.000Z",
        metricsUntil: "2026-03-15T12:00:00.000Z",
      })
    ).toBe(
      "/dashboard/errors/eg_1?app=web&range=none&metricsSince=2026-03-08T12%3A00%3A00.000Z&metricsUntil=2026-03-15T12%3A00%3A00.000Z"
    );
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

describe("buildDashboardNavTabHref", () => {
  it("preserves app/environment/platform/release scope across tabs", () => {
    const sp = new URLSearchParams({
      app: "web",
      environment: "production",
      platform: "ios",
      release: "1.2.0",
      sort: "count",
    });
    expect(buildDashboardNavTabHref("/dashboard/events", sp)).toBe(
      "/dashboard/events?app=web&environment=production&platform=ios&release=1.2.0"
    );
  });

  it("preserves time-window params including metricsUntil", () => {
    const sp = new URLSearchParams({
      release: "1.2.0",
      range: "none",
      metricsUntil: "2026-03-15T12:00:00.000Z",
      page: "2",
    });
    expect(buildDashboardNavTabHref("/dashboard/errors", sp)).toBe(
      "/dashboard/errors?release=1.2.0&range=none&metricsUntil=2026-03-15T12%3A00%3A00.000Z"
    );
  });

  it("preserves custom from/to windows", () => {
    const sp = new URLSearchParams({
      range: "custom",
      from: "2026-03-01T00:00:00.000Z",
      to: "2026-03-08T00:00:00.000Z",
    });
    expect(buildDashboardNavTabHref("/dashboard/sessions", sp)).toBe(
      "/dashboard/sessions?range=custom&from=2026-03-01T00%3A00%3A00.000Z&to=2026-03-08T00%3A00%3A00.000Z"
    );
  });

  it("returns the bare path when no scoped params are present", () => {
    expect(buildDashboardNavTabHref("/dashboard/overview", new URLSearchParams())).toBe(
      "/dashboard/overview"
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

describe("buildSlowRouteEventsHref", () => {
  it("filters $request events by method and path with scope", () => {
    expect(
      buildSlowRouteEventsHref("GET", "/api/cart", {
        app: "api",
        environment: "production",
        range: "7d",
      })
    ).toBe(
      "/dashboard/events?name=%24request&q=GET+%2Fapi%2Fcart&app=api&environment=production&range=7d"
    );
  });
});

describe("buildSlowPageSessionsHref", () => {
  it("filters sessions by page path with scope", () => {
    expect(
      buildSlowPageSessionsHref("/checkout", {
        app: "web",
        platform: "web",
        range: "24h",
      })
    ).toBe("/dashboard/sessions?q=%2Fcheckout&app=web&platform=web&range=24h");
  });
});

describe("buildSlowPageWebVitalEventsHref", () => {
  it("filters $web_vital events by path with scope", () => {
    expect(
      buildSlowPageWebVitalEventsHref("/checkout", {
        release: "1.2.0",
        range: "7d",
      })
    ).toBe(
      "/dashboard/events?name=%24web_vital&q=%2Fcheckout&release=1.2.0&range=7d"
    );
  });
});

describe("formatOverviewDeltaLine", () => {
  it("uses week-ago compare label in stat card copy", () => {
    const line = formatOverviewDeltaLine(8, 5, "errors", "vs same window last week");
    expect(line.text).toBe("+3 vs same window last week");
  });

  it("uses previous-period baseline for zero delta", () => {
    const line = formatOverviewDeltaLine(4, 4, "events", "vs previous 7 days");
    expect(line.text).toBe("Same as previous 7 days");
  });

  it("shows New when rising from a zero baseline", () => {
    const line = formatOverviewDeltaLine(5, 0, "errors", "vs yesterday");
    expect(line.text).toBe("New");
  });

  it("shows em dash when both windows are zero", () => {
    const line = formatOverviewDeltaLine(0, 0, "events", "vs yesterday");
    expect(line.text).toBe("—");
  });
});
