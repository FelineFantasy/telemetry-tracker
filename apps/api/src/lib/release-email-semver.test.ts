import { describe, expect, it } from "vitest";
import {
  compareReleaseVersion,
  formatMinorLineLabel,
  parseReleaseVersion,
  shouldSendProductUpdateEmail,
} from "./release-email-semver.js";

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

describe("compareReleaseVersion", () => {
  it("orders semver tuples", () => {
    expect(compareReleaseVersion({ major: 1, minor: 6, patch: 0 }, { major: 1, minor: 5, patch: 18 })).toBeGreaterThan(
      0
    );
    expect(compareReleaseVersion({ major: 1, minor: 5, patch: 0 }, { major: 1, minor: 6, patch: 0 })).toBeLessThan(0);
  });
});

describe("formatMinorLineLabel", () => {
  it("formats X.Y from a release", () => {
    expect(formatMinorLineLabel({ major: 1, minor: 15, patch: 4 })).toBe("1.15");
  });
});

describe("shouldSendProductUpdateEmail", () => {
  it("skips first tag without lineClose", () => {
    const d = shouldSendProductUpdateEmail("1.5.0", null);
    expect(d.send).toBe(false);
    expect(d.reason).toContain("line_close");
  });

  it("sends first tag with lineClose", () => {
    const d = shouldSendProductUpdateEmail("1.5.0", null, { lineClose: true });
    expect(d.send).toBe(true);
    expect(d.reason).toContain("line close of 1.5");
  });

  it("skips opening a new major line", () => {
    const d = shouldSendProductUpdateEmail("2.0.0", "1.5.18");
    expect(d.send).toBe(false);
    expect(d.reason).toContain("crossed minor/major");
  });

  it("skips opening a new minor line", () => {
    const d = shouldSendProductUpdateEmail("1.6.0", "1.5.18");
    expect(d.send).toBe(false);
    expect(d.reason).toContain("crossed minor/major");
  });

  it("skips mid-line patch-only releases", () => {
    const d = shouldSendProductUpdateEmail("1.5.18", "1.5.17");
    expect(d.send).toBe(false);
    expect(d.reason).toContain("patch-only");
  });

  it("sends on line close for a final patch of the minor", () => {
    const d = shouldSendProductUpdateEmail("1.15.4", "1.14.4", { lineClose: true });
    expect(d.send).toBe(true);
    expect(d.reason).toContain("line close of 1.15");
  });

  it("rejects line close when previous_version is on the same minor line", () => {
    const d = shouldSendProductUpdateEmail("1.15.4", "1.15.3", { lineClose: true });
    expect(d.send).toBe(false);
    expect(d.reason).toContain("same minor line");
  });

  it("sends on line close when closing the only .0 of a line", () => {
    const d = shouldSendProductUpdateEmail("1.15.0", "1.14.4", { lineClose: true });
    expect(d.send).toBe(true);
    expect(d.reason).toContain("line close of 1.15");
  });

  it("skips semver downgrades even with lineClose", () => {
    const d = shouldSendProductUpdateEmail("1.5.0", "1.6.0", { lineClose: true });
    expect(d.send).toBe(false);
    expect(d.reason).toContain("not a forward semver release");
  });

  it("skips invalid previous tags", () => {
    const d = shouldSendProductUpdateEmail("1.6.0", "not-a-version");
    expect(d.send).toBe(false);
    expect(d.reason).toContain("invalid previous tag");
  });
});
