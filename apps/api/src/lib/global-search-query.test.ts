import { describe, expect, it } from "vitest";
import {
  deviceFilterPatterns,
  hasGlobalSearchWork,
  mergeGlobalSearchScope,
  parseGlobalSearchQuery,
} from "./global-search-query.js";
import { GLOBAL_SEARCH_LIMIT_PER_GROUP } from "./global-search.js";

describe("parseGlobalSearchQuery", () => {
  it("parses empty query", () => {
    const parsed = parseGlobalSearchQuery("  ");
    expect(parsed.raw).toBe("");
    expect(parsed.freeTextTerms).toEqual([]);
    expect(parsed.filters).toEqual({});
    expect(parsed.ignoredKeys).toEqual([]);
    expect(hasGlobalSearchWork(parsed)).toBe(false);
  });

  it("parses free-text terms", () => {
    const parsed = parseGlobalSearchQuery("checkout TypeError");
    expect(parsed.freeText).toBe("checkout TypeError");
    expect(parsed.freeTextTerms).toEqual(["checkout", "TypeError"]);
    expect(parsed.filters).toEqual({});
  });

  it("parses structured key:value filters", () => {
    const parsed = parseGlobalSearchQuery(
      "checkout environment:production release:v1.4.0 browser:safari"
    );
    expect(parsed.freeTextTerms).toEqual(["checkout"]);
    expect(parsed.filters).toEqual({
      environment: "production",
      release: "v1.4.0",
      browser: "safari",
    });
  });

  it("ignores unrecognized keys and lists them", () => {
    const parsed = parseGlobalSearchQuery("foo:bar checkout status:open");
    expect(parsed.freeTextTerms).toEqual(["checkout"]);
    expect(parsed.ignoredKeys).toEqual(["foo", "status"]);
    expect(parsed.filters).toEqual({});
  });

  it("treats URL tokens as free text, not ignored https: filters", () => {
    const parsed = parseGlobalSearchQuery(
      "checkout https://example.com/path http://api.test/v1"
    );
    expect(parsed.freeTextTerms).toEqual([
      "checkout",
      "https://example.com/path",
      "http://api.test/v1",
    ]);
    expect(parsed.ignoredKeys).toEqual([]);
    expect(parsed.filters).toEqual({});
  });

  it("keeps supported filters when the value is a URL", () => {
    const parsed = parseGlobalSearchQuery("error:https://cdn.example/stack.js");
    expect(parsed.freeTextTerms).toEqual([]);
    expect(parsed.filters).toEqual({ error: "https://cdn.example/stack.js" });
    expect(parsed.ignoredKeys).toEqual([]);
  });

  it("treats malformed key tokens as free text", () => {
    const parsed = parseGlobalSearchQuery(":bare 1foo:bar");
    expect(parsed.freeTextTerms).toEqual([":bare", "1foo:bar"]);
  });

  it("omits empty filter values", () => {
    const parsed = parseGlobalSearchQuery("environment: release:v1");
    expect(parsed.filters).toEqual({ release: "v1" });
  });

  it("last duplicate filter key wins", () => {
    const parsed = parseGlobalSearchQuery("environment:staging environment:production");
    expect(parsed.filters.environment).toBe("production");
  });

  it("supports date and entity filters", () => {
    const parsed = parseGlobalSearchQuery(
      "error:TypeError user:abc range:7d device:mobile country:SI platform:web"
    );
    expect(parsed.filters).toMatchObject({
      error: "TypeError",
      user: "abc",
      range: "7d",
      device: "mobile",
      country: "SI",
      platform: "web",
    });
  });
});

describe("mergeGlobalSearchScope", () => {
  it("lets query filters override URL scope", () => {
    const parsed = parseGlobalSearchQuery("environment:production release:v2");
    const scope = mergeGlobalSearchScope({
      parsed,
      appId: "web",
      environment: "staging",
      platform: "ios",
      release: "v1",
      range: {},
    });
    expect(scope).toMatchObject({
      appId: "web",
      environment: "production",
      platform: "ios",
      release: "v2",
    });
  });
});

describe("deviceFilterPatterns", () => {
  it("maps mobile and desktop aliases", () => {
    expect(deviceFilterPatterns("mobile")).toContain("%ios%");
    expect(deviceFilterPatterns("desktop")).toContain("%web%");
    expect(deviceFilterPatterns("iPad")).toEqual(["%ipad%"]);
  });
});

describe("GLOBAL_SEARCH_LIMIT_PER_GROUP", () => {
  it("documents the MVP per-group cap", () => {
    expect(GLOBAL_SEARCH_LIMIT_PER_GROUP).toBe(8);
  });
});
