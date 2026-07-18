/**
 * Shared release identity helpers for Release Health (#453) and scoped list filters.
 *
 * Unknown / missing release values are grouped under an explicit sentinel so deep links
 * never rely on an empty `release=` query parameter.
 */

import { Prisma } from "@prisma/client";

/** Explicit URL / API key for null or blank release values. */
export const UNKNOWN_RELEASE_KEY = "__unknown__";

export const UNKNOWN_RELEASE_LABEL = "Unknown";

/**
 * True when a release key / stored value should be treated as Unknown:
 * null, blank/whitespace, or the literal `__unknown__` sentinel.
 */
export function isUnknownReleaseKey(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" || trimmed === UNKNOWN_RELEASE_KEY;
}

/** Map a stored release column value to the stable release key used in APIs and URLs. */
export function releaseKeyFromDbValue(release: string | null | undefined): string {
  return isUnknownReleaseKey(release) ? UNKNOWN_RELEASE_KEY : (release?.trim() ?? UNKNOWN_RELEASE_KEY);
}

export function releaseDisplayLabel(releaseKey: string): string {
  return isUnknownReleaseKey(releaseKey) ? UNKNOWN_RELEASE_LABEL : releaseKey;
}

/** Normalize a SQL release column to NULL (Unknown) or TRIM(value). */
export function normalizeReleaseKeySql(columnSql: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`CASE
    WHEN ${columnSql} IS NULL
      OR TRIM(${columnSql}) = ''
      OR TRIM(${columnSql}) = ${UNKNOWN_RELEASE_KEY}
    THEN NULL
    ELSE TRIM(${columnSql})
  END`;
}

/** Match a release filter (including `__unknown__`) against a SQL column expression. */
export function releaseFilterMatchSql(columnSql: Prisma.Sql, release: string): Prisma.Sql {
  if (isUnknownReleaseKey(release)) {
    return Prisma.sql`(
      ${columnSql} IS NULL
      OR TRIM(${columnSql}) = ''
      OR TRIM(${columnSql}) = ${UNKNOWN_RELEASE_KEY}
    )`;
  }
  const key = release.trim();
  // TRIM so deep links from normalized Release Health keys match padded stored values.
  return Prisma.sql`TRIM(${columnSql}) = ${key}`;
}

/** `AND <match>` when release is set; otherwise empty. */
export function optionalReleaseAndSql(columnSql: Prisma.Sql, release?: string | null): Prisma.Sql {
  if (!release) return Prisma.empty;
  return Prisma.sql`AND ${releaseFilterMatchSql(columnSql, release)}`;
}

/**
 * Prisma where fragment for ErrorOccurrence / similar nullable release columns.
 *
 * Aligns with `releaseFilterMatchSql` / `isUnknownReleaseKey` for Unknown (null, blank,
 * literal sentinel). Prisma cannot express `TRIM(column) = key`, so known keys use
 * equality on the trimmed filter value; padded DB values are matched by the SQL path
 * (Issues list forces the aggregate SQL query whenever `release` is set).
 */
export function releasePrismaWhere(
  release: string | undefined
): { release: string } | { OR: Array<{ release: null } | { release: string }> } | Record<string, never> {
  if (!release) return {};
  if (isUnknownReleaseKey(release)) {
    return {
      OR: [{ release: null }, { release: "" }, { release: UNKNOWN_RELEASE_KEY }],
    };
  }
  return { release: release.trim() };
}
