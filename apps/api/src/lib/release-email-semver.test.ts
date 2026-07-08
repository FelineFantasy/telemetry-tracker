import { describe, expect, it } from "vitest";
import { isMinorOrMajorBump, parseReleaseVersion } from "./release-email-semver.js";

describe("parseReleaseVersion", () => {
  it("parses tags with or without v prefix", () => {
    expect(parseReleaseVersion("v1.5.18")).toEqual({ major: 1, minor: 5, patch: 18 });
    expect(parseReleaseVersion("1.5.18")).toEqual({ major: 1, minor: 5, patch: 18 });
  });

  it("rejects invalid versions", () => {
    expect(parseReleaseVersion("v1.5")).toBeNull();
    expect(parseReleaseVersion("latest")).toBeNull();
  });
});

describe("isMinorOrMajorBump", () => {
  it("sends when no previous tag", () => {
    expect(isMinorOrMajorBump("1.5.0", null).send).toBe(true);
    expect(isMinorOrMajorBump("1.5.0", undefined).send).toBe(true);
  });

  it("sends on major bump", () => {
    const d = isMinorOrMajorBump("2.0.0", "1.5.18");
    expect(d.send).toBe(true);
    expect(d.reason).toContain("major bump");
  });

  it("sends on minor bump", () => {
    const d = isMinorOrMajorBump("1.5.0", "1.4.13");
    expect(d.send).toBe(true);
    expect(d.reason).toContain("minor bump");
  });

  it("skips patch-only releases", () => {
    const d = isMinorOrMajorBump("1.5.18", "1.5.17");
    expect(d.send).toBe(false);
    expect(d.reason).toContain("patch-only");
  });
});
