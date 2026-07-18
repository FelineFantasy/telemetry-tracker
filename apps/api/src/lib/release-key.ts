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

export function isUnknownReleaseKey(value: string | null | undefined): boolean {
  return (value?.trim() ?? "") === UNKNOWN_RELEASE_KEY;
}

/** Map a stored release column value to the stable release key used in APIs and URLs. */
export function releaseKeyFromDbValue(release: string | null | undefined): string {
  const trimmed = release?.trim() ?? "";
  return trimmed === "" ? UNKNOWN_RELEASE_KEY : trimmed;
}

export function releaseDisplayLabel(releaseKey: string): string {
  return isUnknownReleaseKey(releaseKey) ? UNKNOWN_RELEASE_LABEL : releaseKey;
}

/** Normalize a SQL release column to NULL (Unknown) or TRIM(value). */
export function normalizeReleaseKeySql(columnSql: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`CASE
    WHEN ${columnSql} IS NULL OR TRIM(${columnSql}) = '' THEN NULL
    ELSE TRIM(${columnSql})
  END`;
}

/** Match a release filter (including `__unknown__`) against a SQL column expression. */
export function releaseFilterMatchSql(columnSql: Prisma.Sql, release: string): Prisma.Sql {
  if (isUnknownReleaseKey(release)) {
    return Prisma.sql`(${columnSql} IS NULL OR TRIM(${columnSql}) = '')`;
  }
  // TRIM so deep links from normalized Release Health keys match padded stored values.
  return Prisma.sql`TRIM(${columnSql}) = ${release}`;
}

/** `AND <match>` when release is set; otherwise empty. */
export function optionalReleaseAndSql(columnSql: Prisma.Sql, release?: string | null): Prisma.Sql {
  if (!release) return Prisma.empty;
  return Prisma.sql`AND ${releaseFilterMatchSql(columnSql, release)}`;
}

/** Prisma where fragment for ErrorOccurrence / similar nullable release columns. */
export function releasePrismaWhere(
  release: string | undefined
): { release: string } | { OR: Array<{ release: null } | { release: string }> } | Record<string, never> {
  if (!release) return {};
  if (isUnknownReleaseKey(release)) {
    return { OR: [{ release: null }, { release: "" }] };
  }
  return { release };
}
