import { describe, expect, it } from "vitest";
import {
  buildErrorGroupDetailHref,
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
