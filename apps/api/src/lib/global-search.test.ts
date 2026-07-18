import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  globalSearchSessionEnvReleaseSql,
  globalSearchSessionReleaseSql,
} from "./global-search.js";
import { UNKNOWN_RELEASE_KEY } from "./release-key.js";

function prismaSqlText(fragment: Prisma.Sql): string {
  const parts = fragment as unknown as { strings: string[]; values: unknown[] };
  return parts.strings.join("?");
}

function prismaSqlValues(fragment: Prisma.Sql): unknown[] {
  const parts = fragment as unknown as { values: unknown[] };
  return parts.values;
}

describe("globalSearchSessionEnvReleaseSql", () => {
  it("returns null when neither environment nor release is set", () => {
    expect(globalSearchSessionEnvReleaseSql("proj-1", {})).toBeNull();
  });

  it("uses effective-release COALESCE with event fallback for known keys", () => {
    const sql = globalSearchSessionReleaseSql("proj-1", {
      release: "1.2.0",
      platform: "ios",
    });
    expect(sql).not.toBeNull();
    const text = prismaSqlText(sql!);
    expect(text).toContain("COALESCE");
    expect(text).toContain('"Event"');
    expect(prismaSqlValues(sql!)).toContain("1.2.0");
    expect(prismaSqlValues(sql!)).toContain("ios");
  });

  it("includes NULL-env event fallback for environment-only filters", () => {
    const sql = globalSearchSessionEnvReleaseSql("proj-1", {
      environment: "production",
      sessionStartedAt: {
        gte: new Date("2026-01-01T00:00:00.000Z"),
        lte: new Date("2026-01-08T00:00:00.000Z"),
      },
    });
    expect(sql).not.toBeNull();
    const text = prismaSqlText(sql!);
    expect(text).toContain("IS NULL");
    expect(text).toContain('"Event"');
    expect(prismaSqlValues(sql!)).toContain("production");
  });

  it("requires exact Session.environment when release is also set", () => {
    const sql = globalSearchSessionEnvReleaseSql("proj-1", {
      release: "1.2.0",
      environment: "production",
      platform: "web",
    });
    expect(sql).not.toBeNull();
    const text = prismaSqlText(sql!);
    expect(text).toContain("COALESCE");
    // Combined clause: env equality AND effective release (no NULL-env OR branch).
    expect(text).not.toMatch(/environment" IS NULL/);
    expect(prismaSqlValues(sql!)).toEqual(
      expect.arrayContaining(["proj-1", "production", "web", "1.2.0"])
    );
  });

  it("matches Unknown via effective key IS NULL", () => {
    const sql = globalSearchSessionReleaseSql("proj-1", {
      release: UNKNOWN_RELEASE_KEY,
    });
    expect(sql).not.toBeNull();
    expect(prismaSqlText(sql!)).toContain("IS NULL");
  });
});
