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

/**
 * True when a release column normalizes to a known (non-Unknown) key.
 * Used to exclude event-fallback sessions from `release=__unknown__` filters.
 */
export function knownReleaseSql(columnSql: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`${normalizeReleaseKeySql(columnSql)} IS NOT NULL`;
}

/**
 * Session matches `__unknown__` only when Session.release is Unknown and no scoped
 * event carries a known release — same effective-release rule as Release Health.
 */
export function unknownSessionReleaseMatchSql(
  sessionReleaseUnknownMatch: Prisma.Sql,
  knownEventReleaseExists: Prisma.Sql
): Prisma.Sql {
  return Prisma.sql`(
    ${sessionReleaseUnknownMatch}
    AND NOT ${knownEventReleaseExists}
  )`;
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

/** Optional env/platform constraints for event-release attribution. */
export type SessionEffectiveReleaseScope = {
  environment?: string;
  platform?: string;
};

/**
 * Prefer Session.release; when Unknown (null / blank / `__unknown__`), fall back to the
 * latest known Event.release for the same session over all time.
 * Matches Release Health session KPI attribution.
 */
export function sessionEffectiveReleaseKeySql(
  projectId: string,
  sessionAlias: string,
  scope: SessionEffectiveReleaseScope = {}
): Prisma.Sql {
  const s = Prisma.raw(`"${sessionAlias}"`);
  const eventParts: Prisma.Sql[] = [
    Prisma.sql`e."project_id" = ${projectId}`,
    Prisma.sql`e."session_id" = ${s}."session_id"`,
    Prisma.sql`e."app" = ${s}."app"`,
    // Prefer a known (non-Unknown) event release when Session.release is blank.
    knownReleaseSql(Prisma.sql`e."release"`),
  ];
  if (scope.environment) {
    eventParts.push(Prisma.sql`e."environment" = ${scope.environment}`);
  }
  if (scope.platform) {
    eventParts.push(Prisma.sql`e."platform" = ${scope.platform}`);
  }
  return Prisma.sql`COALESCE(
    ${normalizeReleaseKeySql(Prisma.sql`${s}."release"`)},
    (
      SELECT ${normalizeReleaseKeySql(Prisma.sql`e."release"`)}
      FROM "Event" e
      WHERE ${Prisma.join(eventParts, " AND ")}
      ORDER BY e."created_at" DESC
      LIMIT 1
    )
  )`;
}

/**
 * `release=` filter using the same effective-release rule as Release Health:
 * known keys match `COALESCE(session, latest known event)`; Unknown matches when that is NULL.
 */
export function sessionEffectiveReleaseFilterSql(
  projectId: string,
  sessionAlias: string,
  release: string,
  scope: SessionEffectiveReleaseScope = {}
): Prisma.Sql {
  const effective = sessionEffectiveReleaseKeySql(projectId, sessionAlias, scope);
  if (isUnknownReleaseKey(release)) {
    return Prisma.sql`${effective} IS NULL`;
  }
  return Prisma.sql`${effective} = ${release.trim()}`;
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
