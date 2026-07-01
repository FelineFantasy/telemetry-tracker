import { describe, expect, it } from "vitest";
import { alertEventHref } from "./alert-dispatch.js";

describe("alertEventHref", () => {
  it("uses stored href when present", () => {
    expect(alertEventHref("ERROR_SPIKE", "/dashboard/errors/eg-1")).toBe(
      "/dashboard/errors/eg-1"
    );
  });

  it("falls back by rule for legacy rows without href", () => {
    expect(alertEventHref("ERROR_SPIKE", null)).toBe("/dashboard/errors");
    expect(alertEventHref("QUOTA_NEAR", null)).toBe("/dashboard/settings/billing");
    expect(alertEventHref("QUOTA_EXCEEDED", null)).toBe("/dashboard/settings/billing");
  });
});
