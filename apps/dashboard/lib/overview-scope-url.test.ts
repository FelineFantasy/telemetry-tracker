import { describe, expect, it } from "vitest";
import { resolveScopedQueryValue } from "./overview-scope-url";

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
