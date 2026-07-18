/**
 * Events list page summary KPIs and shared filter-scope helpers.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { escapeLikePattern } from "./list-query.js";
import { eventFreeTextMatchSql } from "./list-query-helpers.js";
import { resolveCompareWindow } from "./overview-stats.js";
import type { EventListFilterInput } from "./events-list-query.js";
import { releaseFilterMatchSql } from "./release-key.js";

export type EventsPageSummary = {
  window: {
    since: string;
    until: string;
    label: string;
    compareLabel: string;
  };
  totalEvents: number;
  totalEventsPrevious: number;
  distinctUsers: number;
  distinctUsersPrevious: number;
  uniqueEventNames: number;
  uniqueEventNamesPrevious: number;
  distinctSessions: number;
  distinctSessionsPrevious: number;
};

export type ResolvedSummaryWindow = {
  since: Date;
  until: Date;
  previousSince: Date;
  previousUntil: Date;
  label: string;
  compareLabel: string;
};

const DEFAULT_SUMMARY_MS = 7 * 24 * 60 * 60 * 1000;

/** Shared anchor for default 7-day metrics when list range is all-time. */
export function parseEventsMetricsAnchor(value: string | undefined): Date {
  const raw = value?.trim();
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/** Resolve KPI window from list filters; defaults to last 7 days when range is all-time. */
export function resolveEventsSummaryWindow(
  range: { gte?: Date; lte?: Date },
  anchor: Date = new Date()
): ResolvedSummaryWindow {
  const until = range.lte ?? anchor;
  const since =
    range.gte ?? new Date(until.getTime() - DEFAULT_SUMMARY_MS);
  const durationMs = Math.max(until.getTime() - since.getTime(), 1);
  const { previousSince, previousUntil } = resolveCompareWindow(
    durationMs,
    "previous",
    since,
    until
  );
  const prevUntil = previousUntil ?? since;
  const label = range.gte ? "Selected period" : "Last 7 days";
  return {
    since,
    until,
    previousSince,
    previousUntil: prevUntil,
    label,
    compareLabel: "vs prior period",
  };
}

export function enrichEventListFilterForMetrics(
  filter: EventListFilterInput,
  range: { gte?: Date; lte?: Date },
  anchor: Date = new Date()
): EventListFilterInput {
  if (filter.eventCountRange) return filter;
  if (range.gte && range.lte) return filter;
  const w = resolveEventsSummaryWindow(range, anchor);
  return {
    ...filter,
    eventCountRange: { gte: w.since, lte: w.until },
  };
}

function eventIdentityExpr(alias = "e"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`COALESCE(
    NULLIF(TRIM(COALESCE(${a}."user_id", '')), ''),
    NULLIF(TRIM(COALESCE(${a}."anonymous_id", '')), ''),
    NULLIF(TRIM(COALESCE(${a}."session_id", '')), '')
  )`;
}

export async function fetchEventsPageSummary(
  prisma: PrismaClient,
  f: EventListFilterInput,
  projectId: string,
  window: ResolvedSummaryWindow
): Promise<EventsPageSummary> {
  const { since, until, previousSince, previousUntil } = window;

  const parts: Prisma.Sql[] = [Prisma.sql`e."project_id" = ${projectId}`];
  if (f.appId) parts.push(Prisma.sql`e."app" = ${f.appId}`);
  if (f.name) parts.push(Prisma.sql`e."name" = ${f.name}`);
  if (f.environment) parts.push(Prisma.sql`e."environment" = ${f.environment}`);
  if (f.platform) parts.push(Prisma.sql`e."platform" = ${f.platform}`);
  if (f.release) parts.push(releaseFilterMatchSql(Prisma.sql`e."release"`, f.release));
  if (f.propertiesContains?.trim()) {
    const pat = `%${escapeLikePattern(f.propertiesContains.trim())}%`;
    parts.push(Prisma.sql`e."properties"::text ILIKE ${pat} ESCAPE '\\'`);
  }
  const freeText = eventFreeTextMatchSql(
    f.q,
    Prisma.sql`e."name"`,
    Prisma.sql`e."properties"::text`
  );
  if (freeText) parts.push(freeText);
  const eventFilter = Prisma.join(parts, " AND ");
  const identity = eventIdentityExpr("e");

  const rows = await prisma.$queryRaw<
    [
      {
        total_events: bigint;
        total_events_previous: bigint;
        distinct_users: bigint;
        distinct_users_previous: bigint;
        unique_event_names: bigint;
        unique_event_names_previous: bigint;
        distinct_sessions: bigint;
        distinct_sessions_previous: bigint;
      },
    ]
  >(Prisma.sql`
    SELECT
      COUNT(*) FILTER (
        WHERE e."created_at" >= ${since} AND e."created_at" <= ${until}
      )::bigint AS total_events,
      COUNT(*) FILTER (
        WHERE e."created_at" >= ${previousSince} AND e."created_at" < ${previousUntil}
      )::bigint AS total_events_previous,
      COUNT(DISTINCT ${identity}) FILTER (
        WHERE e."created_at" >= ${since} AND e."created_at" <= ${until}
      )::bigint AS distinct_users,
      COUNT(DISTINCT ${identity}) FILTER (
        WHERE e."created_at" >= ${previousSince} AND e."created_at" < ${previousUntil}
      )::bigint AS distinct_users_previous,
      COUNT(DISTINCT e."name") FILTER (
        WHERE e."created_at" >= ${since} AND e."created_at" <= ${until}
      )::bigint AS unique_event_names,
      COUNT(DISTINCT e."name") FILTER (
        WHERE e."created_at" >= ${previousSince} AND e."created_at" < ${previousUntil}
      )::bigint AS unique_event_names_previous,
      COUNT(DISTINCT e."session_id") FILTER (
        WHERE e."created_at" >= ${since} AND e."created_at" <= ${until}
          AND e."session_id" IS NOT NULL AND TRIM(e."session_id") <> ''
      )::bigint AS distinct_sessions,
      COUNT(DISTINCT e."session_id") FILTER (
        WHERE e."created_at" >= ${previousSince} AND e."created_at" < ${previousUntil}
          AND e."session_id" IS NOT NULL AND TRIM(e."session_id") <> ''
      )::bigint AS distinct_sessions_previous
    FROM "Event" e
    WHERE ${eventFilter}
      AND e."created_at" >= ${previousSince}
      AND e."created_at" <= ${until}
  `);

  const row = rows[0];
  return {
    window: {
      since: since.toISOString(),
      until: until.toISOString(),
      label: window.label,
      compareLabel: window.compareLabel,
    },
    totalEvents: Number(row?.total_events ?? 0),
    totalEventsPrevious: Number(row?.total_events_previous ?? 0),
    distinctUsers: Number(row?.distinct_users ?? 0),
    distinctUsersPrevious: Number(row?.distinct_users_previous ?? 0),
    uniqueEventNames: Number(row?.unique_event_names ?? 0),
    uniqueEventNamesPrevious: Number(row?.unique_event_names_previous ?? 0),
    distinctSessions: Number(row?.distinct_sessions ?? 0),
    distinctSessionsPrevious: Number(row?.distinct_sessions_previous ?? 0),
  };
}
