import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  isUnknownReleaseKey,
  normalizeReleaseKeySql,
  optionalReleaseAndSql,
  releaseFilterMatchSql,
  releasePrismaWhere,
  UNKNOWN_RELEASE_KEY,
} from "./release-key.js";

function prismaSqlText(fragment: Prisma.Sql): string {
  const parts = fragment as unknown as { strings: string[] };
  return parts.strings.join("?");
}

describe("releaseFilterMatchSql", () => {
  it("matches TRIM equality for known releases", () => {
    const sql = releaseFilterMatchSql(Prisma.sql`e."release"`, "1.2.3");
    const text = prismaSqlText(sql);
    expect(text).toContain("TRIM");
    expect(text).toContain(" = ");
  });

  it("matches null/blank for Unknown sentinel", () => {
    const sql = releaseFilterMatchSql(Prisma.sql`e."release"`, UNKNOWN_RELEASE_KEY);
    const text = prismaSqlText(sql);
    expect(text).toContain("IS NULL");
    expect(text).toContain("TRIM");
  });
});

describe("optionalReleaseAndSql", () => {
  it("returns empty when release unset", () => {
    expect(prismaSqlText(optionalReleaseAndSql(Prisma.sql`e."release"`, undefined))).toBe("");
  });

  it("prefixes AND when set", () => {
    expect(prismaSqlText(optionalReleaseAndSql(Prisma.sql`e."release"`, "x"))).toContain("AND");
  });
});

describe("normalizeReleaseKeySql", () => {
  it("builds CASE expression", () => {
    const text = prismaSqlText(normalizeReleaseKeySql(Prisma.sql`e."release"`));
    expect(text).toContain("CASE");
    expect(text).toContain("TRIM");
  });
});

describe("releasePrismaWhere", () => {
  it("returns empty object when unset", () => {
    expect(releasePrismaWhere(undefined)).toEqual({});
  });

  it("returns OR null/empty for Unknown", () => {
    expect(releasePrismaWhere(UNKNOWN_RELEASE_KEY)).toEqual({
      OR: [{ release: null }, { release: "" }],
    });
  });

  it("returns equality for known release", () => {
    expect(releasePrismaWhere("1.0.0")).toEqual({ release: "1.0.0" });
  });
});

describe("isUnknownReleaseKey", () => {
  it("detects sentinel", () => {
    expect(isUnknownReleaseKey(UNKNOWN_RELEASE_KEY)).toBe(true);
    expect(isUnknownReleaseKey("  __unknown__  ")).toBe(true);
    expect(isUnknownReleaseKey("1.0.0")).toBe(false);
  });
});
