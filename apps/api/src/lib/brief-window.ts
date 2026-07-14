/**
 * Per-project brief window boundaries.
 *
 * All projects in one request share the same `until` timestamp. `since` is derived
 * per project from acknowledgement state, project creation time, and the lookback cap.
 */

import { BRIEF_MAX_LOOKBACK_MS } from "./brief-constants.js";

export type BriefProjectWindowInput = {
  projectId: string;
  projectCreatedAt: Date;
  /** Null when the user has never marked this project's brief as read. */
  acknowledgedThrough: Date | null;
  /** Shared upper bound for every project in the request. */
  requestUntil: Date;
};

export type BriefProjectWindow = {
  projectId: string;
  since: Date;
  until: Date;
  previousSince: Date;
  previousUntil: Date;
  durationMs: number;
};

function maxDate(...dates: Date[]): Date {
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

/**
 * Resolve the current and immediately preceding windows for one project.
 *
 * ```
 * since = max(
 *   acknowledgedThrough ?? projectCreatedAt,
 *   projectCreatedAt,
 *   until - BRIEF_MAX_LOOKBACK_MS
 * )
 * previousUntil = since
 * previousSince = since - durationMs
 * ```
 */
export function resolveBriefProjectWindow(input: BriefProjectWindowInput): BriefProjectWindow {
  const { projectId, projectCreatedAt, acknowledgedThrough, requestUntil } = input;
  const until = requestUntil;
  const lookbackFloor = new Date(until.getTime() - BRIEF_MAX_LOOKBACK_MS);
  const ackOrCreated = acknowledgedThrough ?? projectCreatedAt;
  const since = maxDate(ackOrCreated, projectCreatedAt, lookbackFloor);
  const durationMs = Math.max(until.getTime() - since.getTime(), 1);
  const previousUntil = since;
  const previousSince = new Date(since.getTime() - durationMs);

  return {
    projectId,
    since,
    until,
    previousSince,
    previousUntil,
    durationMs,
  };
}

/** Resolve windows for multiple projects using one shared `requestUntil`. */
export function resolveBriefProjectWindows(
  projects: BriefProjectWindowInput[],
  requestUntil: Date
): BriefProjectWindow[] {
  return projects.map((p) =>
    resolveBriefProjectWindow({ ...p, requestUntil })
  );
}
