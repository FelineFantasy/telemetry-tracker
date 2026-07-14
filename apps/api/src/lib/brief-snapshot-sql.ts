/**
 * Shared SQL fragments for brief snapshot batch queries.
 * All count windows use half-open intervals: [since, until) and [previousSince, previousUntil).
 */

import { Prisma } from "@prisma/client";
import type { BriefProjectWindow } from "./brief-window.js";

export type ProjectWindowRow = {
  projectId: string;
  since: Date;
  until: Date;
  previousSince: Date;
  previousUntil: Date;
};

export function sortProjectsById<T extends { projectId: string }>(projects: T[]): T[] {
  return [...projects].sort((a, b) => a.projectId.localeCompare(b.projectId));
}

export function projectWindowsFromBriefWindows(
  windows: BriefProjectWindow[]
): ProjectWindowRow[] {
  return sortProjectsById(
    windows.map((w) => ({
      projectId: w.projectId,
      since: w.since,
      until: w.until,
      previousSince: w.previousSince,
      previousUntil: w.previousUntil,
    }))
  );
}

/** VALUES list joined as `project_windows` CTE. */
export function buildProjectWindowsCte(windows: ProjectWindowRow[]): Prisma.Sql {
  if (windows.length === 0) {
    return Prisma.sql`
      project_windows AS (
        SELECT
          NULL::text AS project_id,
          NULL::timestamptz AS since,
          NULL::timestamptz AS until,
          NULL::timestamptz AS previous_since,
          NULL::timestamptz AS previous_until
        WHERE FALSE
      )`;
  }

  const values = windows.map(
    (w) =>
      Prisma.sql`(
        ${w.projectId}::text,
        ${w.since}::timestamptz,
        ${w.until}::timestamptz,
        ${w.previousSince}::timestamptz,
        ${w.previousUntil}::timestamptz
      )`
  );

  return Prisma.sql`
    project_windows AS (
      SELECT *
      FROM (VALUES ${Prisma.join(values)}) AS pw(
        project_id,
        since,
        until,
        previous_since,
        previous_until
      )
    )`;
}

/** Error occurrence identity for affected-user counts. */
export function errorOccurrenceIdentityExpr(alias = "eo"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`COALESCE(
    NULLIF(TRIM(COALESCE(${a}."user_id", '')), ''),
    NULLIF(TRIM(COALESCE(${a}."anonymous_id", '')), ''),
    NULLIF(TRIM(COALESCE(${a}."session_id", '')), '')
  )`;
}

/** Event active-user identity (user_id, then anonymous_id). */
export function eventActiveUserIdentityExpr(alias = "e"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`COALESCE(
    NULLIF(TRIM(COALESCE(${a}."user_id", '')), ''),
    NULLIF(TRIM(COALESCE(${a}."anonymous_id", '')), '')
  )`;
}

/** Session user identity for session summary distinct users. */
export function sessionUserIdentityExpr(alias = "s"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`COALESCE(
    NULLIF(TRIM(COALESCE(${a}."user_id", '')), ''),
    NULLIF(TRIM(COALESCE(${a}."anonymous_id", '')), '')
  )`;
}

export function errorRatePct(errors: number, events: number): number {
  const total = errors + events;
  if (total <= 0) return 0;
  return Math.round((errors / total) * 10000) / 100;
}

export function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}
