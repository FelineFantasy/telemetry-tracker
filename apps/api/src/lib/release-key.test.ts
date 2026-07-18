import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  isUnknownReleaseKey,
  normalizeReleaseKeySql,
  optionalReleaseAndSql,
  releaseFilterMatchSql,
  releaseKeyFromDbValue,
  releasePrismaWhere,
  UNKNOWN_RELEASE_KEY,
} from "./release-key.js";

function prismaSqlText(fragment: Prisma.Sql): string {
  const parts = fragment as unknown as { strings: string[]; values: unknown[] };
  return parts.strings.join("?");
}

function prismaSqlValues(fragment: Prisma.Sql): unknown[] {
  const parts = fragment as unknown as { values: unknown[] };
  return parts.values;
}

describe("releaseFilterMatchSql", () => {
  it("matches TRIM equality for known releases", () => {
    const sql = releaseFilterMatchSql(Prisma.sql`e."release"`, "1.2.3");
    const text = prismaSqlText(sql);
    expect(text).toContain("TRIM");
    expect(text).toContain(" = ");
    expect(prismaSqlValues(sql)).toContain("1.2.3");
  });

  it("trims the known filter key before equality", () => {
    const sql = releaseFilterMatchSql(Prisma.sql`e."release"`, "  1.2.3  ");
    expect(prismaSqlValues(sql)).toContain("1.2.3");
  });

  it("matches null, blank, and literal sentinel for Unknown", () => {
    const sql = releaseFilterMatchSql(Prisma.sql`e."release"`, UNKNOWN_RELEASE_KEY);
    const text = prismaSqlText(sql);
    expect(text).toContain("IS NULL");
    expect(text).toContain("TRIM");
    expect(prismaSqlValues(sql)).toContain(UNKNOWN_RELEASE_KEY);
  });

  it("treats whitespace-only filter as Unknown", () => {
    const sql = releaseFilterMatchSql(Prisma.sql`e."release"`, "   ");
    const text = prismaSqlText(sql);
    expect(text).toContain("IS NULL");
    expect(prismaSqlValues(sql)).toContain(UNKNOWN_RELEASE_KEY);
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
  it("builds CASE that maps blank and sentinel to NULL", () => {
    const text = prismaSqlText(normalizeReleaseKeySql(Prisma.sql`e."release"`));
    expect(text).toContain("CASE");
    expect(text).toContain("TRIM");
    expect(prismaSqlValues(normalizeReleaseKeySql(Prisma.sql`e."release"`))).toContain(
      UNKNOWN_RELEASE_KEY
    );
  });
});

describe("releasePrismaWhere", () => {
  it("returns empty object when unset", () => {
    expect(releasePrismaWhere(undefined)).toEqual({});
  });

  it("returns OR null/empty/sentinel for Unknown", () => {
    expect(releasePrismaWhere(UNKNOWN_RELEASE_KEY)).toEqual({
      OR: [{ release: null }, { release: "" }, { release: UNKNOWN_RELEASE_KEY }],
    });
  });

  it("treats blank/whitespace filter as Unknown", () => {
    expect(releasePrismaWhere("  ")).toEqual({
      OR: [{ release: null }, { release: "" }, { release: UNKNOWN_RELEASE_KEY }],
    });
  });

  it("returns trimmed equality for known release", () => {
    expect(releasePrismaWhere("1.0.0")).toEqual({ release: "1.0.0" });
    expect(releasePrismaWhere("  1.0.0  ")).toEqual({ release: "1.0.0" });
  });
});

describe("isUnknownReleaseKey", () => {
  it("detects sentinel, null, and blank/whitespace", () => {
    expect(isUnknownReleaseKey(UNKNOWN_RELEASE_KEY)).toBe(true);
    expect(isUnknownReleaseKey("  __unknown__  ")).toBe(true);
    expect(isUnknownReleaseKey(null)).toBe(true);
    expect(isUnknownReleaseKey(undefined)).toBe(true);
    expect(isUnknownReleaseKey("")).toBe(true);
    expect(isUnknownReleaseKey("   ")).toBe(true);
    expect(isUnknownReleaseKey("1.0.0")).toBe(false);
  });
});

describe("releaseKeyFromDbValue", () => {
  it("maps null, blank, and literal sentinel to Unknown key", () => {
    expect(releaseKeyFromDbValue(null)).toBe(UNKNOWN_RELEASE_KEY);
    expect(releaseKeyFromDbValue("")).toBe(UNKNOWN_RELEASE_KEY);
    expect(releaseKeyFromDbValue("  ")).toBe(UNKNOWN_RELEASE_KEY);
    expect(releaseKeyFromDbValue(UNKNOWN_RELEASE_KEY)).toBe(UNKNOWN_RELEASE_KEY);
    expect(releaseKeyFromDbValue("  __unknown__  ")).toBe(UNKNOWN_RELEASE_KEY);
    expect(releaseKeyFromDbValue(" 1.2.3 ")).toBe("1.2.3");
  });
});
