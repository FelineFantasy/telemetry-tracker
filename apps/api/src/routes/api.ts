import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import {
  fetchImpactMetricsForGroupId,
  fetchMetricsForGroupIds,
  fetchSparklinesForGroupIds,
  isAggregateSort,
  listErrorGroupsAggregated,
  listErrorGroupsPrisma,
  parseErrorListOrderParam,
  parseErrorListSortParam,
  parseTrendWindowParam,
  serializeErrorGroupListItem,
  type ErrorGroupListRow,
  type ErrorListFilterInput,
  type ScalarErrorListSort,
} from "../lib/errors-list-query.js";
import { fetchErrorsAnalytics } from "../lib/errors-analytics.js";
import { fetchEventsAnalytics } from "../lib/events-analytics.js";
import {
  enrichErrorListFilterForMetrics,
  fetchErrorsPageSummary,
  parseErrorsMetricsAnchor,
  resolveErrorsSummaryWindow,
} from "../lib/errors-page-summary.js";
import {
  enrichEventListFilterForMetrics,
  fetchEventsPageSummary,
  parseEventsMetricsAnchor,
  resolveEventsSummaryWindow,
} from "../lib/events-page-summary.js";
import {
  fetchSessionsAnalytics,
  parseChartBucketParam,
} from "../lib/sessions-analytics.js";
import {
  fetchSessionsPageSummary,
  buildSessionListFilter,
  parseSessionsMetricsAnchor,
  resolveSessionListStartedAtBounds,
  resolveSessionsSummaryWindow,
} from "../lib/sessions-page-summary.js";
import {
  attachLatestEventIds,
  fetchSparklinesForEventNames,
  listEventNamesGrouped,
  parseEventListOrderParam,
  parseEventListSortParam,
  serializeEventNameListItem,
  type EventListFilterInput,
} from "../lib/events-list-query.js";
import {
  fetchSessionEnrichedById,
  listSessionsEnriched,
  parseSessionListOrderParam,
  parseSessionListSortParam,
  serializeSessionListItem,
} from "../lib/sessions-list-query.js";
import { parseCreatedRange } from "../lib/list-query.js";
import { buildEventWhereSql } from "../lib/list-query-helpers.js";
import { fetchLatestEventsByName } from "../lib/latest-events-by-name.js";
import { getOverviewTimeSeries } from "../lib/overview-timeseries.js";
import {
  buildWorkspaceTelemetry,
  computeOverviewHealth,
  getOverviewActiveUsersPair,
  getOverviewErrorCountsPair,
  getOverviewEventWindowStats,
  getOverviewSessionsPair,
  getSessionDurationSeries,
  listActiveIssues,
  listDistinctEnvironments,
  resolveCompareWindow,
  type OverviewCompareMode,
} from "../lib/overview-stats.js";
import {
  buildOverviewSessionFilter,
  fetchOverviewRequestMetrics,
  listOverviewRecentSessions,
  sparklinesFromTimeSeries,
} from "../lib/overview-kpi.js";
import { getAppNavSummariesForProject } from "../lib/app-nav-summary.js";
import {
  distinctAppsForProject,
  distinctEnvironmentsForProject,
} from "../lib/project-scope-labels.js";
import {
  whereErrorGroupById,
  whereErrorGroupProject,
  whereEventById,
  whereEventProject,
  whereSessionById,
  whereSessionProject,
} from "../lib/prisma-project-scope.js";
import { requireSessionUser } from "../lib/auth-session.js";
import { canResolveErrors, getMembershipRoleForProject } from "../lib/org-permissions.js";
import { readOrganizationIdHeader } from "../lib/http-headers.js";
import { effectiveOverviewWindow, isUnselectedTimeRange, parseOverviewTimeRangeQuery, chooseTimeRangeBucket } from "../lib/time-range.js";
import { resolveUnselectedMetricsWindow } from "../lib/overview-metrics-window.js";
import {
  resolveReadProjectId,
  resolveReadProjectIdWithSession,
} from "../lib/read-project-request.js";
import {
  EVENT_SORT_SQL,
  eventListOrderBy,
  overviewErrorOrderBy,
  parseEventListSortParam as parseRawEventListSortParam,
  parseListOrderParam,
  parseOverviewErrorSortParam,
  parseOverviewTopEventsSortParam,
} from "../lib/list-sort-params.js";

const DEFAULT_LIST_PAGE_SIZE = 20;
const MAX_LIST_PAGE_SIZE = 100;
const OVERVIEW_LIST_PAGE_SIZE = 10;
const MAX_OVERVIEW_LIST_PAGE_SIZE = 50;

function parsePositivePage(value: string | undefined, fallback: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function parseListPageSize(
  pageSize: string | undefined,
  limit: string | undefined,
  fallback = DEFAULT_LIST_PAGE_SIZE
): number {
  const raw = pageSize ?? limit;
  const n = Math.floor(Number(raw));
  const v = Number.isFinite(n) && n >= 1 ? n : fallback;
  return Math.min(MAX_LIST_PAGE_SIZE, Math.max(1, v));
}

/** Fastify can expose repeated query keys as `string[]`; normalize to a single trimmed app id. */
function queryApp(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const t = typeof raw === "string" ? raw.trim() : "";
  return t || undefined;
}

function queryString(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const t = typeof raw === "string" ? raw.trim() : "";
  return t || undefined;
}

export async function apiRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.get("/overview", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const query = request.query as {
      range?: string;
      from?: string;
      to?: string;
      app?: string | string[];
      environment?: string;
      compare?: string;
      errorsPage?: string;
      eventsPage?: string;
      listPageSize?: string;
      errorsSort?: string;
      errorsOrder?: string;
      topEventsSort?: string;
      topEventsOrder?: string;
    };
    const timeRangeParsed = parseOverviewTimeRangeQuery(
      {
        range: queryString(query.range),
        from: queryString(query.from),
        to: queryString(query.to),
      },
      new Date()
    );
    if (!timeRangeParsed.ok) {
      return reply.status(400).send({ error: timeRangeParsed.error });
    }
    const timeRange = timeRangeParsed.range;
    const since = timeRange.gte;
    const until = timeRange.lte;
    const appFilter = queryApp(query.app);
    const environment = queryString(query.environment);
    const metricsWindow = isUnselectedTimeRange(timeRange.key)
      ? await resolveUnselectedMetricsWindow(prisma, {
          projectId,
          until,
          app: appFilter,
          environment,
        })
      : effectiveOverviewWindow(timeRange);
    const metricsBucket = chooseTimeRangeBucket(metricsWindow.durationMs);
    const chartSince = isUnselectedTimeRange(timeRange.key) ? metricsWindow.gte : since;
    const chartUntil = isUnselectedTimeRange(timeRange.key) ? metricsWindow.lte : until;
    const chartBucket = isUnselectedTimeRange(timeRange.key)
      ? metricsBucket.bucket
      : timeRange.bucket;
    const chartBucketSeconds = isUnselectedTimeRange(timeRange.key)
      ? metricsBucket.bucketSeconds
      : timeRange.bucketSeconds;
    const compare: OverviewCompareMode =
      queryString(query.compare) === "week-ago" ? "week-ago" : "previous";
    const errSortParsed = parseOverviewErrorSortParam(queryString(query.errorsSort));
    if (!errSortParsed.ok) {
      return reply.status(400).send({ error: "Invalid errorsSort" });
    }
    const errOrderParsed = parseListOrderParam(queryString(query.errorsOrder));
    if (!errOrderParsed.ok) {
      return reply.status(400).send({ error: "Invalid errorsOrder" });
    }
    const topEvSortParsed = parseOverviewTopEventsSortParam(queryString(query.topEventsSort));
    if (!topEvSortParsed.ok) {
      return reply.status(400).send({ error: "Invalid topEventsSort" });
    }
    const topEvOrderParsed = parseListOrderParam(queryString(query.topEventsOrder));
    if (!topEvOrderParsed.ok) {
      return reply.status(400).send({ error: "Invalid topEventsOrder" });
    }
    const compareWindow = resolveCompareWindow(
      metricsWindow.durationMs,
      compare,
      metricsWindow.gte,
      metricsWindow.lte
    );
    const metricsScope = {
      projectId,
      since: metricsWindow.gte,
      until: metricsWindow.lte,
      app: appFilter,
      environment,
    };
    const listScope = { projectId, since, until, app: appFilter, environment };
    const listPageSize = Math.min(
      MAX_OVERVIEW_LIST_PAGE_SIZE,
      Math.max(
        1,
        Math.floor(Number(query.listPageSize)) || OVERVIEW_LIST_PAGE_SIZE
      )
    );
    const errorsPage = parsePositivePage(query.errorsPage, 1);
    const eventsPage = parsePositivePage(query.eventsPage, 1);
    const errorsSkip = (errorsPage - 1) * listPageSize;
    const eventsSkip = (eventsPage - 1) * listPageSize;

    const errorGroupOrderBy = overviewErrorOrderBy(
      errSortParsed.sort,
      errOrderParsed.order
    );
    const eventGroupByOrderBy =
      topEvSortParsed.sort === "count"
        ? { _count: { name: topEvOrderParsed.order } }
        : { name: topEvOrderParsed.order };

    const baseWhere = {
      ...whereEventProject(projectId),
      created_at: { gte: since, lte: until },
    };
    const eventWhere = {
      ...baseWhere,
      ...(appFilter ? { app: appFilter } : {}),
      ...(environment ? { environment } : {}),
    };
    const errorGroupWhere = {
      ...whereErrorGroupProject(projectId),
      last_seen: { gte: since, lte: until },
      ...(appFilter ? { app: appFilter } : {}),
      ...(environment ? { environment } : {}),
    };

    const previousUntil = compareWindow.previousUntil ?? metricsWindow.gte;
    const windowParams = {
      projectId,
      since: metricsWindow.gte,
      until: metricsWindow.lte,
      previousSince: compareWindow.previousSince,
      previousUntil,
      app: appFilter,
      environment,
    };

    const eventListWhereSql = buildEventWhereSql({
      projectId,
      appId: appFilter,
      environment,
      gte: since,
      lte: until,
    });

    const [
      errorCounts,
      eventStats,
      errorsListTotal,
      eventsListTotal,
      errorGroups,
      eventCounts,
      series,
      sessionCounts,
      activeUserCounts,
      environments,
      sessionDurationSeries,
      activeIssues,
      requestMetrics,
      recentSessions,
    ] = await Promise.all([
      getOverviewErrorCountsPair(prisma, windowParams),
      getOverviewEventWindowStats(prisma, windowParams),
      prisma.errorGroup.count({ where: errorGroupWhere }),
      prisma.$queryRaw<[{ c: bigint }]>(Prisma.sql`
        SELECT COUNT(DISTINCT e."name")::bigint AS c
        FROM "Event" e
        WHERE ${eventListWhereSql}
      `),
      prisma.errorGroup.findMany({
        where: errorGroupWhere,
        skip: errorsSkip,
        take: listPageSize,
        orderBy: errorGroupOrderBy,
        include: { _count: { select: { occurrences_list: true } } },
      }),
      prisma.event.groupBy({
        by: ["name"],
        where: eventWhere,
        _count: { name: true },
        orderBy: eventGroupByOrderBy,
        skip: eventsSkip,
        take: listPageSize,
      }),
      getOverviewTimeSeries(
        prisma,
        projectId,
        chartSince,
        chartUntil,
        chartBucket,
        appFilter,
        environment
      ),
      getOverviewSessionsPair(
        prisma,
        metricsScope,
        compareWindow.previousSince,
        previousUntil
      ),
      getOverviewActiveUsersPair(prisma, windowParams),
      listDistinctEnvironments(prisma, projectId, appFilter),
      getSessionDurationSeries(
        prisma,
        projectId,
        chartBucket,
        chartSince,
        chartUntil,
        appFilter,
        environment
      ),
      listActiveIssues(prisma, listScope),
      fetchOverviewRequestMetrics(
        prisma,
        metricsScope,
        compareWindow.previousSince,
        previousUntil,
        chartBucket
      ),
      listOverviewRecentSessions(
        prisma,
        buildOverviewSessionFilter(metricsScope, {
          gte: metricsWindow.gte,
          lte: metricsWindow.lte,
        }),
        projectId,
        { gte: metricsWindow.gte, lte: metricsWindow.lte },
        8
      ),
    ]);

    const errorsCount = errorCounts.current;
    const errorsPrevious = errorCounts.previous;
    const eventsCount = eventStats.eventsCount;
    const eventsPrevious = eventStats.eventsPrevious;
    const eventsListTotalCount = Number(eventsListTotal[0]?.c ?? 0);
    const workspaceTelemetry = buildWorkspaceTelemetry(
      eventsCount,
      errorsCount,
      eventStats.distinctApps,
      eventStats.distinctSdkVersions
    );
    const sessionsCount = sessionCounts.current;
    const sessionsPrevious = sessionCounts.previous;
    const activeUsers = activeUserCounts.current;
    const activeUsersPrevious = activeUserCounts.previous;

    const health = computeOverviewHealth(
      eventsCount,
      errorsCount,
      eventsPrevious,
      errorsPrevious,
      series.events,
      chartBucketSeconds
    );

    const latestByName = await fetchLatestEventsByName(prisma, {
      projectId,
      since,
      until,
      app: appFilter,
      environment,
      names: eventCounts.map((row) => row.name),
    });

    const topEvents = eventCounts.map((row: { name: string; _count: { name: number } }) => {
      const latest = latestByName.get(row.name);
      return {
        name: row.name,
        count: row._count.name,
        app: latest?.app ?? "",
        platform: latest?.platform ?? null,
        environment: latest?.environment ?? null,
        release: latest?.release ?? null,
        lastSeen: latest?.created_at.toISOString() ?? null,
      };
    });

    return reply.send({
      range: timeRange.key,
      rangeLabel: timeRange.label,
      since: since.toISOString(),
      until: until.toISOString(),
      metricsSince: metricsWindow.gte.toISOString(),
      metricsUntil: metricsWindow.lte.toISOString(),
      metricsDurationMs: metricsWindow.durationMs,
      bucket: chartBucket,
      compare,
      errorsLast24h: errorsCount,
      eventsLast24h: eventsCount,
      errorsPrevious,
      eventsPrevious,
      sessionsCount,
      sessionsPrevious,
      activeUsers,
      activeUsersPrevious,
      environments,
      health,
      activeIssues,
      workspaceTelemetry,
      topErrorGroups: errorGroups,
      topEvents,
      errorsListTotal,
      eventsListTotal: eventsListTotalCount,
      errorsPage,
      eventsPage,
      listPageSize,
      series,
      sessionDurationSeries,
      kpiSparklines: sparklinesFromTimeSeries(series),
      requestMetrics,
      recentSessions,
    });
  });

  app.get("/errors/summary", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const query = request.query as {
      app?: string | string[];
      range?: string;
      from?: string;
      to?: string;
      environment?: string;
      release?: string;
      q?: string;
      status?: string;
      metricsUntil?: string;
    };
    const appId = queryApp(query.app);
    const environment = queryString(query.environment);
    const release = queryString(query.release);
    const q = queryString(query.q);
    const status = queryString(query.status) ?? "all";
    const range = parseCreatedRange(query, "all");
    const metricsAnchor = parseErrorsMetricsAnchor(queryString(query.metricsUntil));

    const filter: ErrorListFilterInput = {
      appId,
      environment,
      release,
      q,
      range,
      status:
        status === "unresolved"
          ? "unresolved"
          : status === "resolved"
            ? "resolved"
            : "all",
    };

    const window = resolveErrorsSummaryWindow(range, metricsAnchor);
    const summary = await fetchErrorsPageSummary(prisma, filter, projectId, window);
    return reply.send(summary);
  });

  app.get("/errors/analytics", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const query = request.query as {
      app?: string | string[];
      range?: string;
      from?: string;
      to?: string;
      environment?: string;
      release?: string;
      q?: string;
      status?: string;
      metricsUntil?: string;
    };
    const appId = queryApp(query.app);
    const environment = queryString(query.environment);
    const release = queryString(query.release);
    const q = queryString(query.q);
    const status = queryString(query.status) ?? "all";
    const range = parseCreatedRange(query, "all");
    const metricsAnchor = parseErrorsMetricsAnchor(queryString(query.metricsUntil));

    const filter: ErrorListFilterInput = {
      appId,
      environment,
      release,
      q,
      range,
      status:
        status === "unresolved"
          ? "unresolved"
          : status === "resolved"
            ? "resolved"
            : "all",
    };

    const window = resolveErrorsSummaryWindow(range, metricsAnchor);
    const analytics = await fetchErrorsAnalytics(prisma, filter, projectId, window);
    return reply.send(analytics);
  });

  app.get("/errors", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const query = request.query as {
      app?: string | string[];
      page?: string;
      pageSize?: string;
      limit?: string;
      range?: string;
      from?: string;
      to?: string;
      environment?: string;
      release?: string;
      q?: string;
      status?: string;
      sort?: string;
      order?: string;
      trendWindow?: string;
      trendFrom?: string;
      trendTo?: string;
      metricsUntil?: string;
    };
    const pageSize = parseListPageSize(query.pageSize, query.limit);
    const page = parsePositivePage(query.page, 1);
    const skip = (page - 1) * pageSize;
    const appId = queryApp(query.app);
    const environment = queryString(query.environment);
    const release = queryString(query.release);
    const q = queryString(query.q);
    const status = queryString(query.status) ?? "all";
    const range = parseCreatedRange(query, "all");
    const metricsAnchor = parseErrorsMetricsAnchor(queryString(query.metricsUntil));

    const sortParsed = parseErrorListSortParam(queryString(query.sort));
    if (!sortParsed.ok) {
      return reply.status(400).send({ error: "Invalid sort" });
    }
    const orderParsed = parseErrorListOrderParam(queryString(query.order));
    if (!orderParsed.ok) {
      return reply.status(400).send({ error: "Invalid order" });
    }
    const trendEnd = range.lte ?? new Date();
    const trendWindowParsed = parseTrendWindowParam(
      {
        trendWindow: queryString(query.trendWindow),
        trendFrom: queryString(query.trendFrom),
        trendTo: queryString(query.trendTo),
      },
      trendEnd
    );
    if (!trendWindowParsed.ok) {
      return reply.status(400).send({ error: trendWindowParsed.error });
    }
    const trend = trendWindowParsed.trend;

    const filter: ErrorListFilterInput = {
      appId,
      environment,
      release,
      q,
      range,
      status:
        status === "unresolved"
          ? "unresolved"
          : status === "resolved"
            ? "resolved"
            : "all",
    };
    const metricsFilter = enrichErrorListFilterForMetrics(filter, range, metricsAnchor);

    if (isAggregateSort(sortParsed.sort)) {
      const { total, rows } = await listErrorGroupsAggregated(
        prisma,
        metricsFilter,
        projectId,
        sortParsed.sort,
        orderParsed.order,
        trend.durationMs,
        trend.end,
        skip,
        pageSize
      );
      const sparklines = await fetchSparklinesForGroupIds(
        prisma,
        rows.map((r) => r.id),
        trend.durationMs,
        trend.end,
        metricsFilter.release
      );
      const items = rows.map((r) =>
        serializeErrorGroupListItem({
          ...r,
          sparkline: sparklines.get(r.id) ?? [],
        })
      );
      return reply.send({ items, total, page, pageSize });
    }

    const scalarSort = sortParsed.sort as ScalarErrorListSort;
    const { total, groups } = await listErrorGroupsPrisma(
      prisma,
      filter,
      projectId,
      scalarSort,
      orderParsed.order,
      skip,
      pageSize
    );
    const metrics = await fetchMetricsForGroupIds(
      prisma,
      groups.map((g) => g.id),
      trend.durationMs,
      trend.end,
      {
        range: metricsFilter.range,
        release: metricsFilter.release,
        occurrenceCountRange: metricsFilter.occurrenceCountRange,
      }
    );
    const sparklines = await fetchSparklinesForGroupIds(
      prisma,
      groups.map((g) => g.id),
      trend.durationMs,
      trend.end,
      metricsFilter.release
    );
    const items = groups.map((g) => {
      const m = metrics.get(g.id);
      const row: ErrorGroupListRow = {
        id: g.id,
        fingerprint: g.fingerprint,
        message: g.message,
        top_stack: g.top_stack,
        app: g.app,
        environment: g.environment,
        occurrences: g.occurrences,
        first_seen: g.first_seen,
        last_seen: g.last_seen,
        resolved_at: g.resolved_at,
        users_affected: m?.users_affected ?? 0,
        sessions_affected: m?.sessions_affected ?? 0,
        occurrences_recent: m?.occurrences_recent ?? 0,
        occurrences_previous: m?.occurrences_previous ?? 0,
        trend_ratio: m?.trend_ratio ?? 0,
        occurrences_in_range: m?.occurrences_in_range ?? 0,
        sparkline: sparklines.get(g.id) ?? [],
      };
      return serializeErrorGroupListItem(row);
    });
    return reply.send({ items, total, page, pageSize });
  });

  app.patch<{ Params: { id: string } }>("/errors/:id", async (request, reply) => {
    const session = await requireSessionUser(request, reply);
    if (!session) return;
    const projectId = await resolveReadProjectIdWithSession(request, reply, session);
    if (projectId === null) return;
    const role = await getMembershipRoleForProject(session.userId, projectId);
    if (!canResolveErrors(role)) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    const body = request.body as { resolved?: boolean };
    if (typeof body?.resolved !== "boolean") {
      return reply.status(400).send({ error: "Body must be JSON with resolved: boolean" });
    }
    try {
      const existing = await prisma.errorGroup.findFirst({
        where: whereErrorGroupById(request.params.id, projectId),
      });
      if (!existing) return reply.status(404).send({ error: "Not found" });
      const group = await prisma.errorGroup.update({
        where: { id: existing.id },
        data: { resolved_at: body.resolved ? new Date() : null },
      });
      return reply.send(group);
    } catch {
      return reply.status(404).send({ error: "Not found" });
    }
  });

  app.get<{ Params: { id: string } }>("/errors/:id", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const { id } = request.params;
    const group = await prisma.errorGroup.findFirst({
      where: whereErrorGroupById(id, projectId),
      include: {
        occurrences_list: {
          orderBy: { created_at: "desc" },
          take: 50,
        },
      },
    });
    if (!group) return reply.status(404).send({ error: "Not found" });
    const { enrichErrorGroupWithSymbolicatedStacks } = await import("../lib/stack-symbolicate.js");
    const [enriched, impact] = await Promise.all([
      enrichErrorGroupWithSymbolicatedStacks(prisma, projectId, group),
      fetchImpactMetricsForGroupId(prisma, id),
    ]);
    return reply.send({ ...enriched, ...impact });
  });

  app.get("/events/summary", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const query = request.query as {
      app?: string | string[];
      range?: string;
      from?: string;
      to?: string;
      name?: string;
      environment?: string;
      platform?: string;
      release?: string;
      propertiesContains?: string;
      metricsUntil?: string;
    };
    const appId = queryApp(query.app);
    const name = queryString(query.name);
    const environment = queryString(query.environment);
    const platform = queryString(query.platform);
    const release = queryString(query.release);
    const propertiesContains = queryString(query.propertiesContains);
    const range = parseCreatedRange(query, "all");
    const metricsAnchor = parseEventsMetricsAnchor(queryString(query.metricsUntil));

    const filter: EventListFilterInput = {
      appId,
      name,
      environment,
      platform,
      release,
      propertiesContains,
      range,
    };

    const window = resolveEventsSummaryWindow(range, metricsAnchor);
    const summary = await fetchEventsPageSummary(prisma, filter, projectId, window);
    return reply.send(summary);
  });

  app.get("/events/analytics", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const query = request.query as {
      app?: string | string[];
      range?: string;
      from?: string;
      to?: string;
      name?: string;
      environment?: string;
      platform?: string;
      release?: string;
      propertiesContains?: string;
      metricsUntil?: string;
    };
    const appId = queryApp(query.app);
    const name = queryString(query.name);
    const environment = queryString(query.environment);
    const platform = queryString(query.platform);
    const release = queryString(query.release);
    const propertiesContains = queryString(query.propertiesContains);
    const range = parseCreatedRange(query, "all");
    const metricsAnchor = parseEventsMetricsAnchor(queryString(query.metricsUntil));

    const filter: EventListFilterInput = {
      appId,
      name,
      environment,
      platform,
      release,
      propertiesContains,
      range,
    };

    const window = resolveEventsSummaryWindow(range, metricsAnchor);
    const analytics = await fetchEventsAnalytics(prisma, filter, projectId, window);
    return reply.send(analytics);
  });

  app.get("/events", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const query = request.query as {
      app?: string | string[];
      page?: string;
      pageSize?: string;
      limit?: string;
      name?: string;
      range?: string;
      from?: string;
      to?: string;
      environment?: string;
      platform?: string;
      release?: string;
      propertiesContains?: string;
      sort?: string;
      order?: string;
      view?: string;
      metricsUntil?: string;
    };
    const pageSize = parseListPageSize(query.pageSize, query.limit);
    const page = parsePositivePage(query.page, 1);
    const skip = (page - 1) * pageSize;
    const appId = queryApp(query.app);
    const name = queryString(query.name);
    const environment = queryString(query.environment);
    const platform = queryString(query.platform);
    const release = queryString(query.release);
    const propertiesContains = queryString(query.propertiesContains);
    const range = parseCreatedRange(query, "all");
    const view = queryString(query.view) ?? "grouped";
    const metricsAnchor = parseEventsMetricsAnchor(queryString(query.metricsUntil));

    if (view === "grouped") {
      const sortParsed = parseEventListSortParam(queryString(query.sort));
      if (!sortParsed.ok) {
        return reply.status(400).send({ error: "Invalid sort" });
      }
      const orderParsed = parseEventListOrderParam(queryString(query.order));
      if (!orderParsed.ok) {
        return reply.status(400).send({ error: "Invalid order" });
      }

      const filter: EventListFilterInput = {
        appId,
        name,
        environment,
        platform,
        release,
        propertiesContains,
        range,
      };
      const metricsFilter = enrichEventListFilterForMetrics(filter, range, metricsAnchor);

      const { total, rows } = await listEventNamesGrouped(
        prisma,
        metricsFilter,
        projectId,
        sortParsed.sort,
        orderParsed.order,
        skip,
        pageSize
      );
      const [withIds, sparklines] = await Promise.all([
        attachLatestEventIds(prisma, rows, metricsFilter, projectId),
        fetchSparklinesForEventNames(
          prisma,
          rows.map((r) => r.name),
          metricsFilter,
          projectId
        ),
      ]);
      const items = withIds.map((r) =>
        serializeEventNameListItem({
          ...r,
          sparkline: sparklines.get(r.name) ?? [],
        })
      );
      return reply.send({ items, total, page, pageSize, view: "grouped" });
    }

    const sortParsed = parseRawEventListSortParam(queryString(query.sort));
    if (!sortParsed.ok) {
      return reply.status(400).send({ error: "Invalid sort" });
    }
    const orderParsed = parseListOrderParam(queryString(query.order));
    if (!orderParsed.ok) {
      return reply.status(400).send({ error: "Invalid order" });
    }
    const eventOrderBy = eventListOrderBy(sortParsed.sort, orderParsed.order);
    const orderDirSql =
      orderParsed.order === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    const props = propertiesContains?.trim();
    if (props) {
      const whereSql = buildEventWhereSql({
        projectId,
        appId,
        name,
        environment,
        platform,
        release,
        gte: range.gte,
        lte: range.lte,
        propertiesContains: props,
      });
      const ob = EVENT_SORT_SQL[sortParsed.sort];
      const [countRow, rows] = await Promise.all([
        prisma.$queryRaw<[{ c: bigint }]>(
          Prisma.sql`SELECT COUNT(*)::bigint AS c FROM "Event" WHERE ${whereSql}`
        ),
        prisma.$queryRaw<Record<string, unknown>[]>(
          Prisma.sql`SELECT * FROM "Event" WHERE ${whereSql} ORDER BY ${ob} ${orderDirSql} LIMIT ${pageSize} OFFSET ${skip}`
        ),
      ]);
      const total = Number(countRow[0]?.c ?? 0);
      return reply.send({ items: rows, total, page, pageSize, view: "raw" });
    }

    const where: Prisma.EventWhereInput = whereEventProject(projectId);
    if (appId) where.app = appId;
    if (name) where.name = name;
    if (environment) where.environment = environment;
    if (platform) where.platform = platform;
    if (release) where.release = release;
    if (range.gte || range.lte) {
      where.created_at = {};
      if (range.gte) where.created_at.gte = range.gte;
      if (range.lte) where.created_at.lte = range.lte;
    }
    const [total, list] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: eventOrderBy,
      }),
    ]);
    return reply.send({ items: list, total, page, pageSize, view: "raw" });
  });

  app.get<{ Params: { id: string } }>("/events/:id", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const { id } = request.params;
    const event = await prisma.event.findFirst({
      where: whereEventById(id, projectId),
    });
    if (!event) return reply.status(404).send({ error: "Not found" });
    return reply.send(event);
  });

  app.get("/sessions/summary", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const query = request.query as {
      app?: string | string[];
      range?: string;
      from?: string;
      to?: string;
      platform?: string;
      environment?: string;
      release?: string;
      country?: string;
      q?: string;
      metricsUntil?: string;
    };
    const appId = queryApp(query.app);
    const platform = queryString(query.platform);
    const environment = queryString(query.environment);
    const release = queryString(query.release);
    const country = queryString(query.country);
    const q = queryString(query.q);
    const range = parseCreatedRange(query, "all");
    const metricsAnchor = parseSessionsMetricsAnchor(queryString(query.metricsUntil));

    const filter = buildSessionListFilter({
      appId,
      platform,
      environment,
      release,
      country,
      q,
      range,
    });
    const window = resolveSessionsSummaryWindow(range, metricsAnchor);
    const summary = await fetchSessionsPageSummary(prisma, filter, projectId, window);
    return reply.send(summary);
  });

  app.get("/sessions/analytics", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const query = request.query as {
      app?: string | string[];
      range?: string;
      from?: string;
      to?: string;
      platform?: string;
      environment?: string;
      release?: string;
      country?: string;
      q?: string;
      metricsUntil?: string;
      chartBucket?: string;
    };
    const appId = queryApp(query.app);
    const platform = queryString(query.platform);
    const environment = queryString(query.environment);
    const release = queryString(query.release);
    const country = queryString(query.country);
    const q = queryString(query.q);
    const range = parseCreatedRange(query, "all");
    const metricsAnchor = parseSessionsMetricsAnchor(queryString(query.metricsUntil));
    const chartBucket = parseChartBucketParam(queryString(query.chartBucket));

    const filter = buildSessionListFilter({
      appId,
      platform,
      environment,
      release,
      country,
      q,
      range,
    });
    const window = resolveSessionsSummaryWindow(range, metricsAnchor);
    const analytics = await fetchSessionsAnalytics(
      prisma,
      filter,
      projectId,
      window,
      chartBucket
    );
    return reply.send(analytics);
  });

  app.get("/sessions", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const query = request.query as {
      app?: string | string[];
      page?: string;
      pageSize?: string;
      limit?: string;
      range?: string;
      from?: string;
      to?: string;
      platform?: string;
      environment?: string;
      release?: string;
      country?: string;
      q?: string;
      sort?: string;
      order?: string;
      metricsUntil?: string;
    };
    const pageSize = parseListPageSize(query.pageSize, query.limit);
    const page = parsePositivePage(query.page, 1);
    const skip = (page - 1) * pageSize;
    const appId = queryApp(query.app);
    const platform = queryString(query.platform);
    const environment = queryString(query.environment);
    const release = queryString(query.release);
    const country = queryString(query.country);
    const q = queryString(query.q);
    const range = parseCreatedRange(query, "all");
    const metricsAnchor = parseSessionsMetricsAnchor(queryString(query.metricsUntil));
    const sortParsed = parseSessionListSortParam(queryString(query.sort));
    if (!sortParsed.ok) {
      return reply.status(400).send({ error: "Invalid sort" });
    }
    const orderParsed = parseSessionListOrderParam(queryString(query.order));
    if (!orderParsed.ok) {
      return reply.status(400).send({ error: "Invalid order" });
    }

    const filter = buildSessionListFilter({
      appId,
      platform,
      environment,
      release,
      country,
      q,
      range,
    });
    const startedAt = resolveSessionListStartedAtBounds(range, metricsAnchor);
    const { total, rows, maxDurationSec } = await listSessionsEnriched(
      prisma,
      filter,
      projectId,
      startedAt,
      sortParsed.sort,
      orderParsed.order,
      skip,
      pageSize
    );
    return reply.send({
      items: rows.map((row) => serializeSessionListItem(row, maxDurationSec)),
      total,
      page,
      pageSize,
      max_duration_sec: maxDurationSec,
    });
  });

  app.get<{ Params: { id: string } }>("/sessions/:id", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const { id } = request.params;
    const session = await prisma.session.findFirst({
      where: whereSessionById(id, projectId),
    });
    if (!session) return reply.status(404).send({ error: "Not found" });
    const enriched = await fetchSessionEnrichedById(prisma, projectId, session.id);
    if (!enriched) return reply.status(404).send({ error: "Not found" });
    return reply.send(serializeSessionListItem(enriched));
  });

  app.get("/filter-options", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const appFilter = queryApp((request.query as { app?: string | string[] }).app);
    const baseEvent: Prisma.EventWhereInput = appFilter
      ? { ...whereEventProject(projectId), app: appFilter }
      : whereEventProject(projectId);
    const baseSession: Prisma.SessionWhereInput = appFilter
      ? { ...whereSessionProject(projectId), app: appFilter }
      : whereSessionProject(projectId);

    const [environments, platEvents, platSessions, relEvents, relErrors, countrySessions] =
      await Promise.all([
      distinctEnvironmentsForProject(prisma, projectId, appFilter),
      prisma.event.groupBy({
        by: ["platform"],
        where: { ...baseEvent, platform: { not: null } },
      }),
      prisma.session.groupBy({
        by: ["platform"],
        where: { ...baseSession, platform: { not: null } },
      }),
      prisma.event.groupBy({
        by: ["release"],
        where: { ...baseEvent, release: { not: null } },
      }),
      prisma.errorOccurrence.groupBy({
        by: ["release"],
        where: {
          release: { not: null },
          error_group: appFilter
            ? { project_id: projectId, app: appFilter }
            : { project_id: projectId },
        },
      }),
      prisma.session.groupBy({
        by: ["country"],
        where: { ...baseSession, country: { not: null } },
      }),
    ]);

    const platforms = [
      ...new Set([
        ...platEvents.map((r) => r.platform).filter(Boolean) as string[],
        ...platSessions.map((r) => r.platform).filter(Boolean) as string[],
      ]),
    ].sort();
    const releases = [
      ...new Set([
        ...relEvents.map((r) => r.release).filter(Boolean) as string[],
        ...relErrors.map((r) => r.release).filter(Boolean) as string[],
      ]),
    ].sort();
    const countries = countrySessions
      .map((r) => r.country)
      .filter((x): x is string => x != null && x !== "")
      .sort();

    return reply.send({ environments, platforms, releases, countries });
  });

  app.get("/apps", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const headerOrg = readOrganizationIdHeader(request);
    if (headerOrg) {
      const row = await prisma.project.findFirst({
        where: { id: projectId, deleted_at: null },
        select: { organization_id: true },
      });
      if (!row || row.organization_id.toLowerCase() !== headerOrg.toLowerCase()) {
        return reply.status(403).send({ error: "Project is not in the selected organization" });
      }
    }
    const apps = await distinctAppsForProject(prisma, projectId);
    return reply.send({ apps });
  });

  app.get("/apps/nav-summary", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const headerOrg = readOrganizationIdHeader(request);
    if (headerOrg) {
      const row = await prisma.project.findFirst({
        where: { id: projectId, deleted_at: null },
        select: { organization_id: true },
      });
      if (!row || row.organization_id.toLowerCase() !== headerOrg) {
        return reply.status(403).send({ error: "Project is not in the selected organization" });
      }
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const summaries = await getAppNavSummariesForProject(prisma, projectId, since);
    return reply.send({ summaries });
  });
}
