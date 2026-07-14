/**
 * Batched workspace queries for brief snapshot assembly.
 * Query groups run sequentially; queries inside a group may run in parallel.
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  BRIEF_MAX_CANDIDATES_PER_LIST,
  BRIEF_MAX_DEVICE_SLICE_ROWS,
  BRIEF_MAX_ENVIRONMENT_ROWS,
  BRIEF_MAX_RELEASE_ROWS,
} from "./brief-constants.js";
import { BOUNCE_MAX_DURATION_SECONDS } from "./sessions-page-summary.js";
import {
  buildProjectWindowsCte,
  errorOccurrenceIdentityExpr,
  errorRatePct,
  eventActiveUserIdentityExpr,
  pct,
  sessionUserIdentityExpr,
  type ProjectWindowRow,
} from "./brief-snapshot-sql.js";

export type BriefProjectKpis = {
  errors: { count: number; previous: number };
  events: { count: number; previous: number };
  sessions: { count: number; previous: number };
  activeUsers: { count: number; previous: number };
  errorRatePct: { value: number; previous: number };
};

export type BriefSessionSummary = {
  avgDurationSec?: { value: number; previous: number };
  bounceRatePct?: { value: number; previous: number };
  crashFreeRatePct?: { value: number; previous: number };
  activeUsers?: { value: number; previous: number };
};

export type BriefCandidateBase = {
  projectId: string;
  id: string;
  message: string;
  app: string;
  environment: string | null;
  release: string | null;
  firstSeen: Date;
  lastSeen: Date;
};

export type BriefCandidateMetrics = {
  occurrences: { count: number; previous: number };
  affectedUsers: { count: number; previous: number };
};

export type BriefReleaseRow = {
  projectId: string;
  release: string;
  errorOccurrences: number;
  eventRows: number;
};

export type BriefEnvironmentRow = {
  projectId: string;
  environment: string;
  count: number;
};

export type BriefBatchData = {
  kpis: Map<string, BriefProjectKpis>;
  sessionsSummary: Map<string, BriefSessionSummary>;
  firstSeenInWindow: Map<string, BriefCandidateBase[]>;
  byOccurrenceCount: Map<string, BriefCandidateBase[]>;
  byAbsoluteDelta: Map<string, BriefCandidateBase[]>;
  candidateMetrics: Map<string, BriefCandidateMetrics>;
  topBrowsers: Map<string, Map<string, Array<{ browser: string; count: number }>>>;
  topOs: Map<string, Map<string, Array<{ os: string; count: number }>>>;
  releases: Map<string, BriefReleaseRow[]>;
  environments: Map<string, BriefEnvironmentRow[]>;
};

function emptyCandidateMaps(projectIds: string[]) {
  const firstSeenInWindow = new Map<string, BriefCandidateBase[]>();
  const byOccurrenceCount = new Map<string, BriefCandidateBase[]>();
  const byAbsoluteDelta = new Map<string, BriefCandidateBase[]>();
  for (const projectId of projectIds) {
    firstSeenInWindow.set(projectId, []);
    byOccurrenceCount.set(projectId, []);
    byAbsoluteDelta.set(projectId, []);
  }
  return { firstSeenInWindow, byOccurrenceCount, byAbsoluteDelta };
}

async function fetchErrorKpis(
  prisma: PrismaClient,
  windows: ProjectWindowRow[]
): Promise<Map<string, Pick<BriefProjectKpis, "errors">>> {
  const out = new Map<string, Pick<BriefProjectKpis, "errors">>();
  if (windows.length === 0) return out;

  const rows = await prisma.$queryRaw<
    { project_id: string; errors_count: bigint; errors_previous: bigint }[]
  >(Prisma.sql`
    WITH ${buildProjectWindowsCte(windows)}
    SELECT
      pw.project_id,
      COUNT(*) FILTER (
        WHERE eo."created_at" >= pw.since AND eo."created_at" < pw.until
      )::bigint AS errors_count,
      COUNT(*) FILTER (
        WHERE eo."created_at" >= pw.previous_since AND eo."created_at" < pw.previous_until
      )::bigint AS errors_previous
    FROM project_windows pw
    INNER JOIN "ErrorGroup" eg ON eg."project_id" = pw.project_id
    INNER JOIN "ErrorOccurrence" eo ON eo."error_group_id" = eg."id"
    GROUP BY pw.project_id
  `);

  for (const w of windows) {
    out.set(w.projectId, { errors: { count: 0, previous: 0 } });
  }
  for (const row of rows) {
    out.set(row.project_id, {
      errors: {
        count: Number(row.errors_count),
        previous: Number(row.errors_previous),
      },
    });
  }
  return out;
}

async function fetchEventKpis(
  prisma: PrismaClient,
  windows: ProjectWindowRow[]
): Promise<Map<string, Pick<BriefProjectKpis, "events">>> {
  const out = new Map<string, Pick<BriefProjectKpis, "events">>();
  if (windows.length === 0) return out;

  const rows = await prisma.$queryRaw<
    { project_id: string; events_count: bigint; events_previous: bigint }[]
  >(Prisma.sql`
    WITH ${buildProjectWindowsCte(windows)}
    SELECT
      pw.project_id,
      COUNT(*) FILTER (
        WHERE e."created_at" >= pw.since AND e."created_at" < pw.until
      )::bigint AS events_count,
      COUNT(*) FILTER (
        WHERE e."created_at" >= pw.previous_since AND e."created_at" < pw.previous_until
      )::bigint AS events_previous
    FROM project_windows pw
    INNER JOIN "Event" e ON e."project_id" = pw.project_id
    GROUP BY pw.project_id
  `);

  for (const w of windows) {
    out.set(w.projectId, { events: { count: 0, previous: 0 } });
  }
  for (const row of rows) {
    out.set(row.project_id, {
      events: {
        count: Number(row.events_count),
        previous: Number(row.events_previous),
      },
    });
  }
  return out;
}

async function fetchSessionKpis(
  prisma: PrismaClient,
  windows: ProjectWindowRow[]
): Promise<Map<string, Pick<BriefProjectKpis, "sessions">>> {
  const out = new Map<string, Pick<BriefProjectKpis, "sessions">>();
  if (windows.length === 0) return out;

  const rows = await prisma.$queryRaw<
    { project_id: string; sessions_count: bigint; sessions_previous: bigint }[]
  >(Prisma.sql`
    WITH ${buildProjectWindowsCte(windows)}
    SELECT
      pw.project_id,
      COUNT(*) FILTER (
        WHERE s."started_at" >= pw.since AND s."started_at" < pw.until
      )::bigint AS sessions_count,
      COUNT(*) FILTER (
        WHERE s."started_at" >= pw.previous_since AND s."started_at" < pw.previous_until
      )::bigint AS sessions_previous
    FROM project_windows pw
    INNER JOIN "Session" s ON s."project_id" = pw.project_id
    GROUP BY pw.project_id
  `);

  for (const w of windows) {
    out.set(w.projectId, { sessions: { count: 0, previous: 0 } });
  }
  for (const row of rows) {
    out.set(row.project_id, {
      sessions: {
        count: Number(row.sessions_count),
        previous: Number(row.sessions_previous),
      },
    });
  }
  return out;
}

async function fetchActiveUserKpis(
  prisma: PrismaClient,
  windows: ProjectWindowRow[]
): Promise<Map<string, Pick<BriefProjectKpis, "activeUsers">>> {
  const out = new Map<string, Pick<BriefProjectKpis, "activeUsers">>();
  if (windows.length === 0) return out;

  const identity = eventActiveUserIdentityExpr("e");
  const rows = await prisma.$queryRaw<
    { project_id: string; active_users: bigint; active_users_previous: bigint }[]
  >(Prisma.sql`
    WITH ${buildProjectWindowsCte(windows)}
    SELECT
      pw.project_id,
      COUNT(DISTINCT CASE
        WHEN e."created_at" >= pw.since AND e."created_at" < pw.until
        THEN ${identity}
      END)::bigint AS active_users,
      COUNT(DISTINCT CASE
        WHEN e."created_at" >= pw.previous_since AND e."created_at" < pw.previous_until
        THEN ${identity}
      END)::bigint AS active_users_previous
    FROM project_windows pw
    INNER JOIN "Event" e ON e."project_id" = pw.project_id
    WHERE e."user_id" IS NOT NULL OR e."anonymous_id" IS NOT NULL
    GROUP BY pw.project_id
  `);

  for (const w of windows) {
    out.set(w.projectId, { activeUsers: { count: 0, previous: 0 } });
  }
  for (const row of rows) {
    out.set(row.project_id, {
      activeUsers: {
        count: Number(row.active_users),
        previous: Number(row.active_users_previous),
      },
    });
  }
  return out;
}

async function fetchSessionSummaries(
  prisma: PrismaClient,
  windows: ProjectWindowRow[]
): Promise<Map<string, BriefSessionSummary>> {
  const out = new Map<string, BriefSessionSummary>();
  if (windows.length === 0) return out;

  const identity = sessionUserIdentityExpr("s");
  const bounceSec = BOUNCE_MAX_DURATION_SECONDS;
  const rows = await prisma.$queryRaw<
    {
      project_id: string;
      total_sessions: bigint;
      total_sessions_previous: bigint;
      distinct_users: bigint;
      distinct_users_previous: bigint;
      avg_duration_sec: number | null;
      avg_duration_sec_previous: number | null;
      bounce_sessions: bigint;
      bounce_sessions_previous: bigint;
      crash_free_sessions: bigint;
      crash_free_sessions_previous: bigint;
    }[]
  >(Prisma.sql`
    WITH ${buildProjectWindowsCte(windows)}
    SELECT
      pw.project_id,
      COUNT(*) FILTER (
        WHERE s."started_at" >= pw.since AND s."started_at" < pw.until
      )::bigint AS total_sessions,
      COUNT(*) FILTER (
        WHERE s."started_at" >= pw.previous_since AND s."started_at" < pw.previous_until
      )::bigint AS total_sessions_previous,
      COUNT(DISTINCT ${identity}) FILTER (
        WHERE s."started_at" >= pw.since AND s."started_at" < pw.until
      )::bigint AS distinct_users,
      COUNT(DISTINCT ${identity}) FILTER (
        WHERE s."started_at" >= pw.previous_since AND s."started_at" < pw.previous_until
      )::bigint AS distinct_users_previous,
      AVG(EXTRACT(EPOCH FROM (s."ended_at" - s."started_at"))) FILTER (
        WHERE s."started_at" >= pw.since AND s."started_at" < pw.until
          AND s."ended_at" IS NOT NULL
      ) AS avg_duration_sec,
      AVG(EXTRACT(EPOCH FROM (s."ended_at" - s."started_at"))) FILTER (
        WHERE s."started_at" >= pw.previous_since AND s."started_at" < pw.previous_until
          AND s."ended_at" IS NOT NULL
      ) AS avg_duration_sec_previous,
      COUNT(*) FILTER (
        WHERE s."started_at" >= pw.since AND s."started_at" < pw.until
          AND (
            (s."ended_at" IS NOT NULL
              AND EXTRACT(EPOCH FROM (s."ended_at" - s."started_at")) < ${bounceSec})
            OR COALESCE(ev.event_count, 0) = 1
          )
      )::bigint AS bounce_sessions,
      COUNT(*) FILTER (
        WHERE s."started_at" >= pw.previous_since AND s."started_at" < pw.previous_until
          AND (
            (s."ended_at" IS NOT NULL
              AND EXTRACT(EPOCH FROM (s."ended_at" - s."started_at")) < ${bounceSec})
            OR COALESCE(ev.event_count, 0) = 1
          )
      )::bigint AS bounce_sessions_previous,
      COUNT(*) FILTER (
        WHERE s."started_at" >= pw.since AND s."started_at" < pw.until
          AND NOT EXISTS (
            SELECT 1 FROM "ErrorOccurrence" eo
            INNER JOIN "ErrorGroup" eg ON eg."id" = eo."error_group_id"
            WHERE eo."session_id" = s."session_id"
              AND eg."project_id" = pw.project_id
          )
      )::bigint AS crash_free_sessions,
      COUNT(*) FILTER (
        WHERE s."started_at" >= pw.previous_since AND s."started_at" < pw.previous_until
          AND NOT EXISTS (
            SELECT 1 FROM "ErrorOccurrence" eo
            INNER JOIN "ErrorGroup" eg ON eg."id" = eo."error_group_id"
            WHERE eo."session_id" = s."session_id"
              AND eg."project_id" = pw.project_id
          )
      )::bigint AS crash_free_sessions_previous
    FROM project_windows pw
    INNER JOIN "Session" s ON s."project_id" = pw.project_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS event_count
      FROM "Event" e
      WHERE e."project_id" = s."project_id"
        AND e."session_id" = s."session_id"
        AND e."app" = s."app"
    ) ev ON TRUE
    GROUP BY pw.project_id
  `);

  for (const w of windows) {
    out.set(w.projectId, {});
  }
  for (const row of rows) {
    const totalSessions = Number(row.total_sessions);
    const totalSessionsPrevious = Number(row.total_sessions_previous);
    out.set(row.project_id, {
      avgDurationSec: {
        value: Math.round(Number(row.avg_duration_sec ?? 0)),
        previous: Math.round(Number(row.avg_duration_sec_previous ?? 0)),
      },
      bounceRatePct: {
        value: pct(Number(row.bounce_sessions), totalSessions),
        previous: pct(Number(row.bounce_sessions_previous), totalSessionsPrevious),
      },
      crashFreeRatePct: {
        value: pct(Number(row.crash_free_sessions), totalSessions),
        previous: pct(Number(row.crash_free_sessions_previous), totalSessionsPrevious),
      },
      activeUsers: {
        value: Number(row.distinct_users),
        previous: Number(row.distinct_users_previous),
      },
    });
  }
  return out;
}

function mapCandidateRows(
  rows: {
    project_id: string;
    id: string;
    message: string;
    app: string;
    environment: string | null;
    release: string | null;
    first_seen: Date;
    last_seen: Date;
  }[]
): Map<string, BriefCandidateBase[]> {
  const out = new Map<string, BriefCandidateBase[]>();
  for (const row of rows) {
    const list = out.get(row.project_id) ?? [];
    list.push({
      projectId: row.project_id,
      id: row.id,
      message: row.message,
      app: row.app,
      environment: row.environment,
      release: row.release,
      firstSeen: row.first_seen,
      lastSeen: row.last_seen,
    });
    out.set(row.project_id, list);
  }
  return out;
}

async function fetchFirstSeenCandidates(
  prisma: PrismaClient,
  windows: ProjectWindowRow[]
): Promise<Map<string, BriefCandidateBase[]>> {
  if (windows.length === 0) return new Map();

  const rows = await prisma.$queryRaw<
    {
      project_id: string;
      id: string;
      message: string;
      app: string;
      environment: string | null;
      release: string | null;
      first_seen: Date;
      last_seen: Date;
    }[]
  >(Prisma.sql`
    WITH ${buildProjectWindowsCte(windows)},
    ranked AS (
      SELECT
        eg."project_id",
        eg."id",
        eg."message",
        eg."app",
        eg."environment",
        eg."release",
        eg."first_seen",
        eg."last_seen",
        ROW_NUMBER() OVER (
          PARTITION BY eg."project_id"
          ORDER BY eg."first_seen" DESC, eg."id" ASC
        ) AS rn
      FROM "ErrorGroup" eg
      INNER JOIN project_windows pw ON pw.project_id = eg."project_id"
      WHERE eg."first_seen" >= pw.since AND eg."first_seen" < pw.until
    )
    SELECT project_id, id, message, app, environment, release, first_seen, last_seen
    FROM ranked
    WHERE rn <= ${BRIEF_MAX_CANDIDATES_PER_LIST}
    ORDER BY project_id ASC, first_seen DESC, id ASC
  `);

  return mapCandidateRows(rows);
}

async function fetchOccurrenceCountCandidates(
  prisma: PrismaClient,
  windows: ProjectWindowRow[]
): Promise<Map<string, BriefCandidateBase[]>> {
  if (windows.length === 0) return new Map();

  const rows = await prisma.$queryRaw<
    {
      project_id: string;
      id: string;
      message: string;
      app: string;
      environment: string | null;
      release: string | null;
      first_seen: Date;
      last_seen: Date;
    }[]
  >(Prisma.sql`
    WITH ${buildProjectWindowsCte(windows)},
    counts AS (
      SELECT
        eg."project_id",
        eg."id",
        eg."message",
        eg."app",
        eg."environment",
        eg."release",
        eg."first_seen",
        eg."last_seen",
        COUNT(*)::bigint AS occurrence_count
      FROM "ErrorGroup" eg
      INNER JOIN project_windows pw ON pw.project_id = eg."project_id"
      INNER JOIN "ErrorOccurrence" eo ON eo."error_group_id" = eg."id"
      WHERE eo."created_at" >= pw.since AND eo."created_at" < pw.until
      GROUP BY
        eg."project_id",
        eg."id",
        eg."message",
        eg."app",
        eg."environment",
        eg."release",
        eg."first_seen",
        eg."last_seen"
    ),
    ranked AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY project_id
          ORDER BY occurrence_count DESC, last_seen DESC, id ASC
        ) AS rn
      FROM counts
    )
    SELECT project_id, id, message, app, environment, release, first_seen, last_seen
    FROM ranked
    WHERE rn <= ${BRIEF_MAX_CANDIDATES_PER_LIST}
    ORDER BY project_id ASC, occurrence_count DESC, last_seen DESC, id ASC
  `);

  return mapCandidateRows(rows);
}

async function fetchAbsoluteDeltaCandidates(
  prisma: PrismaClient,
  windows: ProjectWindowRow[]
): Promise<Map<string, BriefCandidateBase[]>> {
  if (windows.length === 0) return new Map();

  const rows = await prisma.$queryRaw<
    {
      project_id: string;
      id: string;
      message: string;
      app: string;
      environment: string | null;
      release: string | null;
      first_seen: Date;
      last_seen: Date;
    }[]
  >(Prisma.sql`
    WITH ${buildProjectWindowsCte(windows)},
    counts AS (
      SELECT
        eg."project_id",
        eg."id",
        eg."message",
        eg."app",
        eg."environment",
        eg."release",
        eg."first_seen",
        eg."last_seen",
        COUNT(*) FILTER (
          WHERE eo."created_at" >= pw.since AND eo."created_at" < pw.until
        )::bigint AS current_count,
        COUNT(*) FILTER (
          WHERE eo."created_at" >= pw.previous_since AND eo."created_at" < pw.previous_until
        )::bigint AS previous_count
      FROM "ErrorGroup" eg
      INNER JOIN project_windows pw ON pw.project_id = eg."project_id"
      INNER JOIN "ErrorOccurrence" eo ON eo."error_group_id" = eg."id"
      GROUP BY
        eg."project_id",
        eg."id",
        eg."message",
        eg."app",
        eg."environment",
        eg."release",
        eg."first_seen",
        eg."last_seen"
      HAVING
        COUNT(*) FILTER (WHERE eo."created_at" >= pw.since AND eo."created_at" < pw.until) > 0
        OR COUNT(*) FILTER (
          WHERE eo."created_at" >= pw.previous_since AND eo."created_at" < pw.previous_until
        ) > 0
    ),
    ranked AS (
      SELECT
        *,
        ABS(current_count - previous_count) AS absolute_delta,
        ROW_NUMBER() OVER (
          PARTITION BY project_id
          ORDER BY ABS(current_count - previous_count) DESC, current_count DESC, id ASC
        ) AS rn
      FROM counts
    )
    SELECT project_id, id, message, app, environment, release, first_seen, last_seen
    FROM ranked
    WHERE rn <= ${BRIEF_MAX_CANDIDATES_PER_LIST}
    ORDER BY project_id ASC, absolute_delta DESC, id ASC
  `);

  return mapCandidateRows(rows);
}

async function fetchCandidateMetrics(
  prisma: PrismaClient,
  windows: ProjectWindowRow[],
  groupIds: string[]
): Promise<Map<string, BriefCandidateMetrics>> {
  const out = new Map<string, BriefCandidateMetrics>();
  if (groupIds.length === 0) return out;

  const identity = errorOccurrenceIdentityExpr("eo");
  const idList = groupIds.map((id) => Prisma.sql`${id}`);
  const rows = await prisma.$queryRaw<
    {
      id: string;
      occurrences_count: bigint;
      occurrences_previous: bigint;
      affected_users_count: bigint;
      affected_users_previous: bigint;
    }[]
  >(Prisma.sql`
    WITH ${buildProjectWindowsCte(windows)}
    SELECT
      eg."id",
      COUNT(*) FILTER (
        WHERE eo."created_at" >= pw.since AND eo."created_at" < pw.until
      )::bigint AS occurrences_count,
      COUNT(*) FILTER (
        WHERE eo."created_at" >= pw.previous_since AND eo."created_at" < pw.previous_until
      )::bigint AS occurrences_previous,
      COUNT(DISTINCT ${identity}) FILTER (
        WHERE eo."created_at" >= pw.since AND eo."created_at" < pw.until
      )::bigint AS affected_users_count,
      COUNT(DISTINCT ${identity}) FILTER (
        WHERE eo."created_at" >= pw.previous_since AND eo."created_at" < pw.previous_until
      )::bigint AS affected_users_previous
    FROM "ErrorGroup" eg
    INNER JOIN project_windows pw ON pw.project_id = eg."project_id"
    INNER JOIN "ErrorOccurrence" eo ON eo."error_group_id" = eg."id"
    WHERE eg."id" IN (${Prisma.join(idList)})
    GROUP BY eg."id"
  `);

  for (const row of rows) {
    out.set(row.id, {
      occurrences: {
        count: Number(row.occurrences_count),
        previous: Number(row.occurrences_previous),
      },
      affectedUsers: {
        count: Number(row.affected_users_count),
        previous: Number(row.affected_users_previous),
      },
    });
  }
  return out;
}

async function fetchTopBrowsers(
  prisma: PrismaClient,
  windows: ProjectWindowRow[],
  groupIds: string[]
): Promise<Map<string, Map<string, Array<{ browser: string; count: number }>>>> {
  const out = new Map<string, Map<string, Array<{ browser: string; count: number }>>>();
  if (groupIds.length === 0) return out;

  const idList = groupIds.map((id) => Prisma.sql`${id}`);
  const rows = await prisma.$queryRaw<
    { project_id: string; error_group_id: string; browser: string; count: bigint; rn: bigint }[]
  >(Prisma.sql`
    WITH ${buildProjectWindowsCte(windows)},
    ranked AS (
      SELECT
        eg."project_id",
        eo."error_group_id",
        s."device_browser" AS browser,
        COUNT(*)::bigint AS count,
        ROW_NUMBER() OVER (
          PARTITION BY eg."project_id", eo."error_group_id"
          ORDER BY COUNT(*) DESC, s."device_browser" ASC
        ) AS rn
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eg."id" = eo."error_group_id"
      INNER JOIN project_windows pw ON pw.project_id = eg."project_id"
      LEFT JOIN "Session" s
        ON s."session_id" = eo."session_id"
        AND s."project_id" = eg."project_id"
      WHERE eo."error_group_id" IN (${Prisma.join(idList)})
        AND eo."created_at" >= pw.since AND eo."created_at" < pw.until
        AND s."device_browser" IS NOT NULL
        AND TRIM(s."device_browser") <> ''
      GROUP BY eg."project_id", eo."error_group_id", s."device_browser"
    )
    SELECT project_id, error_group_id, browser, count, rn
    FROM ranked
    WHERE rn <= ${BRIEF_MAX_DEVICE_SLICE_ROWS}
    ORDER BY project_id ASC, error_group_id ASC, count DESC, browser ASC
  `);

  for (const row of rows) {
    const byProject = out.get(row.project_id) ?? new Map();
    const list = byProject.get(row.error_group_id) ?? [];
    list.push({ browser: row.browser, count: Number(row.count) });
    byProject.set(row.error_group_id, list);
    out.set(row.project_id, byProject);
  }
  return out;
}

async function fetchTopOs(
  prisma: PrismaClient,
  windows: ProjectWindowRow[],
  groupIds: string[]
): Promise<Map<string, Map<string, Array<{ os: string; count: number }>>>> {
  const out = new Map<string, Map<string, Array<{ os: string; count: number }>>>();
  if (groupIds.length === 0) return out;

  const idList = groupIds.map((id) => Prisma.sql`${id}`);
  const rows = await prisma.$queryRaw<
    { project_id: string; error_group_id: string; os: string; count: bigint; rn: bigint }[]
  >(Prisma.sql`
    WITH ${buildProjectWindowsCte(windows)},
    ranked AS (
      SELECT
        eg."project_id",
        eo."error_group_id",
        s."device_os" AS os,
        COUNT(*)::bigint AS count,
        ROW_NUMBER() OVER (
          PARTITION BY eg."project_id", eo."error_group_id"
          ORDER BY COUNT(*) DESC, s."device_os" ASC
        ) AS rn
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eg."id" = eo."error_group_id"
      INNER JOIN project_windows pw ON pw.project_id = eg."project_id"
      LEFT JOIN "Session" s
        ON s."session_id" = eo."session_id"
        AND s."project_id" = eg."project_id"
      WHERE eo."error_group_id" IN (${Prisma.join(idList)})
        AND eo."created_at" >= pw.since AND eo."created_at" < pw.until
        AND s."device_os" IS NOT NULL
        AND TRIM(s."device_os") <> ''
      GROUP BY eg."project_id", eo."error_group_id", s."device_os"
    )
    SELECT project_id, error_group_id, os, count, rn
    FROM ranked
    WHERE rn <= ${BRIEF_MAX_DEVICE_SLICE_ROWS}
    ORDER BY project_id ASC, error_group_id ASC, count DESC, os ASC
  `);

  for (const row of rows) {
    const byProject = out.get(row.project_id) ?? new Map();
    const list = byProject.get(row.error_group_id) ?? [];
    list.push({ os: row.os, count: Number(row.count) });
    byProject.set(row.error_group_id, list);
    out.set(row.project_id, byProject);
  }
  return out;
}

async function fetchReleaseRows(
  prisma: PrismaClient,
  windows: ProjectWindowRow[]
): Promise<Map<string, BriefReleaseRow[]>> {
  const out = new Map<string, BriefReleaseRow[]>();
  if (windows.length === 0) return out;

  const rows = await prisma.$queryRaw<
    {
      project_id: string;
      release: string;
      error_occurrences: bigint;
      event_rows: bigint;
    }[]
  >(Prisma.sql`
    WITH ${buildProjectWindowsCte(windows)},
    error_counts AS (
      SELECT
        eg."project_id",
        eo."release" AS release,
        COUNT(*)::bigint AS error_occurrences
      FROM "ErrorOccurrence" eo
      INNER JOIN "ErrorGroup" eg ON eg."id" = eo."error_group_id"
      INNER JOIN project_windows pw ON pw.project_id = eg."project_id"
      WHERE eo."created_at" >= pw.since AND eo."created_at" < pw.until
        AND eo."release" IS NOT NULL
        AND TRIM(eo."release") <> ''
      GROUP BY eg."project_id", eo."release"
    ),
    event_counts AS (
      SELECT
        e."project_id",
        e."release" AS release,
        COUNT(*)::bigint AS event_rows
      FROM "Event" e
      INNER JOIN project_windows pw ON pw.project_id = e."project_id"
      WHERE e."created_at" >= pw.since AND e."created_at" < pw.until
        AND e."release" IS NOT NULL
        AND TRIM(e."release") <> ''
      GROUP BY e."project_id", e."release"
    ),
    merged AS (
      SELECT
        COALESCE(ec.project_id, ev.project_id) AS project_id,
        COALESCE(ec.release, ev.release) AS release,
        COALESCE(ec.error_occurrences, 0)::bigint AS error_occurrences,
        COALESCE(ev.event_rows, 0)::bigint AS event_rows
      FROM error_counts ec
      FULL OUTER JOIN event_counts ev
        ON ec.project_id = ev.project_id AND ec.release = ev.release
    ),
    ranked AS (
      SELECT
        *,
        ROW_NUMBER() OVER (
          PARTITION BY project_id
          ORDER BY error_occurrences DESC, event_rows DESC, release ASC
        ) AS rn
      FROM merged
      WHERE error_occurrences > 0
    )
    SELECT project_id, release, error_occurrences, event_rows
    FROM ranked
    WHERE rn <= ${BRIEF_MAX_RELEASE_ROWS}
    ORDER BY project_id ASC, error_occurrences DESC, event_rows DESC, release ASC
  `);

  for (const row of rows) {
    const list = out.get(row.project_id) ?? [];
    list.push({
      projectId: row.project_id,
      release: row.release,
      errorOccurrences: Number(row.error_occurrences),
      eventRows: Number(row.event_rows),
    });
    out.set(row.project_id, list);
  }
  return out;
}

async function fetchEnvironmentRows(
  prisma: PrismaClient,
  windows: ProjectWindowRow[]
): Promise<Map<string, BriefEnvironmentRow[]>> {
  const out = new Map<string, BriefEnvironmentRow[]>();
  if (windows.length === 0) return out;

  const rows = await prisma.$queryRaw<
    { project_id: string; environment: string; count: bigint }[]
  >(Prisma.sql`
    WITH ${buildProjectWindowsCte(windows)},
    ranked AS (
      SELECT
        e."project_id",
        e."environment" AS environment,
        COUNT(*)::bigint AS count,
        ROW_NUMBER() OVER (
          PARTITION BY e."project_id"
          ORDER BY COUNT(*) DESC, e."environment" ASC
        ) AS rn
      FROM "Event" e
      INNER JOIN project_windows pw ON pw.project_id = e."project_id"
      WHERE e."created_at" >= pw.since AND e."created_at" < pw.until
        AND e."environment" IS NOT NULL
        AND TRIM(e."environment") <> ''
      GROUP BY e."project_id", e."environment"
    )
    SELECT project_id, environment, count
    FROM ranked
    WHERE rn <= ${BRIEF_MAX_ENVIRONMENT_ROWS}
    ORDER BY project_id ASC, count DESC, environment ASC
  `);

  for (const row of rows) {
    const list = out.get(row.project_id) ?? [];
    list.push({
      projectId: row.project_id,
      environment: row.environment,
      count: Number(row.count),
    });
    out.set(row.project_id, list);
  }
  return out;
}

function mergeKpis(
  windows: ProjectWindowRow[],
  errors: Map<string, Pick<BriefProjectKpis, "errors">>,
  events: Map<string, Pick<BriefProjectKpis, "events">>,
  sessions: Map<string, Pick<BriefProjectKpis, "sessions">>,
  activeUsers: Map<string, Pick<BriefProjectKpis, "activeUsers">>
): Map<string, BriefProjectKpis> {
  const out = new Map<string, BriefProjectKpis>();
  for (const w of windows) {
    const e = errors.get(w.projectId)?.errors ?? { count: 0, previous: 0 };
    const ev = events.get(w.projectId)?.events ?? { count: 0, previous: 0 };
    const s = sessions.get(w.projectId)?.sessions ?? { count: 0, previous: 0 };
    const u = activeUsers.get(w.projectId)?.activeUsers ?? { count: 0, previous: 0 };
    out.set(w.projectId, {
      errors: e,
      events: ev,
      sessions: s,
      activeUsers: u,
      errorRatePct: {
        value: errorRatePct(e.count, ev.count),
        previous: errorRatePct(e.previous, ev.previous),
      },
    });
  }
  return out;
}

function collectGroupIds(
  ...maps: Array<Map<string, BriefCandidateBase[]>>
): string[] {
  const ids = new Set<string>();
  for (const map of maps) {
    for (const list of map.values()) {
      for (const row of list) ids.add(row.id);
    }
  }
  return [...ids].sort();
}

/** Fetch all batched workspace data in four sequential query groups. */
export async function fetchBriefBatchData(
  prisma: PrismaClient,
  windows: ProjectWindowRow[]
): Promise<BriefBatchData> {
  const projectIds = windows.map((w) => w.projectId);

  const [errors, events, sessions, activeUsers, sessionsSummary] = await Promise.all([
    fetchErrorKpis(prisma, windows),
    fetchEventKpis(prisma, windows),
    fetchSessionKpis(prisma, windows),
    fetchActiveUserKpis(prisma, windows),
    fetchSessionSummaries(prisma, windows),
  ]);

  const [firstSeenInWindow, byOccurrenceCount, byAbsoluteDelta] = await Promise.all([
    fetchFirstSeenCandidates(prisma, windows),
    fetchOccurrenceCountCandidates(prisma, windows),
    fetchAbsoluteDeltaCandidates(prisma, windows),
  ]);

  const groupIds = collectGroupIds(firstSeenInWindow, byOccurrenceCount, byAbsoluteDelta);
  const [candidateMetrics, topBrowsers, topOs] = await Promise.all([
    fetchCandidateMetrics(prisma, windows, groupIds),
    fetchTopBrowsers(prisma, windows, groupIds),
    fetchTopOs(prisma, windows, groupIds),
  ]);

  const [releases, environments] = await Promise.all([
    fetchReleaseRows(prisma, windows),
    fetchEnvironmentRows(prisma, windows),
  ]);

  const emptyMaps = emptyCandidateMaps(projectIds);
  return {
    kpis: mergeKpis(windows, errors, events, sessions, activeUsers),
    sessionsSummary,
    firstSeenInWindow: mergeCandidateMap(emptyMaps.firstSeenInWindow, firstSeenInWindow),
    byOccurrenceCount: mergeCandidateMap(emptyMaps.byOccurrenceCount, byOccurrenceCount),
    byAbsoluteDelta: mergeCandidateMap(emptyMaps.byAbsoluteDelta, byAbsoluteDelta),
    candidateMetrics,
    topBrowsers,
    topOs,
    releases,
    environments,
  };
}

function mergeCandidateMap(
  base: Map<string, BriefCandidateBase[]>,
  fetched: Map<string, BriefCandidateBase[]>
): Map<string, BriefCandidateBase[]> {
  const out = new Map(base);
  for (const [projectId, list] of fetched) {
    out.set(projectId, list);
  }
  return out;
}

/** @internal Number of database round-trips in fetchBriefBatchData. */
export const BRIEF_BATCH_QUERY_COUNT = 13;
