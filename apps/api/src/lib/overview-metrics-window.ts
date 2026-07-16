/**
 * Metrics window for overview when no time filter is selected.
 * Spans recent data volume (sample of latest events/errors), not a fixed calendar length.
 */
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rows sampled per stream when inferring the unselected metrics span. */
export const UNSELECTED_METRICS_SAMPLE_SIZE = 10_000;

/** Minimum metrics window so sparse projects are not overly jittery. */
export const UNSELECTED_METRICS_MIN_MS = 7 * DAY_MS;

/** Maximum metrics window so high-volume history does not dilute rates. */
export const UNSELECTED_METRICS_MAX_MS = 90 * DAY_MS;

/** Window when no telemetry exists yet (also used as dashboard sync fallback). */
export const UNSELECTED_METRICS_FALLBACK_MS = 30 * DAY_MS;

export type MetricsWindow = {
  gte: Date;
  lte: Date;
  durationMs: number;
};

/** @internal Pure helper — exported for unit tests. */
export function clampUnselectedMetricsDurationMs(
  dataSpanMs: number | null | undefined,
  fallbackMs: number = UNSELECTED_METRICS_FALLBACK_MS
): number {
  if (dataSpanMs == null || !Number.isFinite(dataSpanMs) || dataSpanMs <= 0) {
    return fallbackMs;
  }
  return Math.min(UNSELECTED_METRICS_MAX_MS, Math.max(UNSELECTED_METRICS_MIN_MS, dataSpanMs));
}

export function buildMetricsWindowFromDuration(until: Date, durationMs: number): MetricsWindow {
  const safeDurationMs = Math.max(durationMs, 1);
  return {
    gte: new Date(until.getTime() - safeDurationMs),
    lte: until,
    durationMs: safeDurationMs,
  };
}

export function buildFallbackUnselectedMetricsWindow(
  until: Date = new Date()
): MetricsWindow {
  return buildMetricsWindowFromDuration(until, UNSELECTED_METRICS_FALLBACK_MS);
}

/**
 * Infer a metrics/compare window from the time span covered by recent telemetry.
 * Lists remain all-time; this only scopes headline metrics, charts, and comparisons.
 */
export async function resolveUnselectedMetricsWindow(
  prisma: PrismaClient,
  params: {
    projectId: string;
    until: Date;
    app?: string;
    environment?: string;
    platform?: string;
    release?: string;
  }
): Promise<MetricsWindow> {
  const { projectId, until, app, environment, platform, release } = params;

  const appEventClause = app ? Prisma.sql`AND e."app" = ${app}` : Prisma.empty;
  const envEventClause = environment
    ? Prisma.sql`AND e."environment" = ${environment}`
    : Prisma.empty;
  const platformEventClause = platform
    ? Prisma.sql`AND e."platform" = ${platform}`
    : Prisma.empty;
  const releaseEventClause = release
    ? Prisma.sql`AND e."release" = ${release}`
    : Prisma.empty;
  const appErrorClause = app ? Prisma.sql`AND eg."app" = ${app}` : Prisma.empty;
  const envErrorClause = environment
    ? Prisma.sql`AND eg."environment" = ${environment}`
    : Prisma.empty;
  const platformErrorClause = platform
    ? Prisma.sql`AND eo."platform" = ${platform}`
    : Prisma.empty;
  const releaseErrorClause = release
    ? Prisma.sql`AND eo."release" = ${release}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<{ oldest: Date | null }[]>(Prisma.sql`
    SELECT MIN(ts) AS oldest
    FROM (
      SELECT ts FROM (
        SELECT e."created_at" AS ts
        FROM "Event" e
        WHERE e."project_id" = ${projectId}
          ${appEventClause}
          ${envEventClause}
          ${platformEventClause}
          ${releaseEventClause}
        ORDER BY e."created_at" DESC
        LIMIT ${UNSELECTED_METRICS_SAMPLE_SIZE}
      ) recent_events
      UNION ALL
      SELECT ts FROM (
        SELECT eo."created_at" AS ts
        FROM "ErrorOccurrence" eo
        INNER JOIN "ErrorGroup" eg ON eo."error_group_id" = eg.id
        WHERE eg."project_id" = ${projectId}
          ${appErrorClause}
          ${envErrorClause}
          ${platformErrorClause}
          ${releaseErrorClause}
        ORDER BY eo."created_at" DESC
        LIMIT ${UNSELECTED_METRICS_SAMPLE_SIZE}
      ) recent_errors
    ) combined
  `);

  const oldest = rows[0]?.oldest;
  const dataSpanMs = oldest != null ? until.getTime() - oldest.getTime() : null;
  const durationMs = clampUnselectedMetricsDurationMs(dataSpanMs);
  return buildMetricsWindowFromDuration(until, durationMs);
}
