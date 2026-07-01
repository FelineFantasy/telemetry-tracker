import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import {
  fetchMetricsForGroupIds,
  isAggregateSort,
  listErrorGroupsAggregated,
  listErrorGroupsPrisma,
  parseErrorListOrderParam,
  parseErrorListSortParam,
  parseTrendWindowParam,
  serializeErrorGroupListItem,
  type ErrorListFilterInput,
  type ScalarErrorListSort,
} from "../lib/errors-list-query.js";
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
import { effectiveOverviewWindow, parseOverviewTimeRangeQuery } from "../lib/time-range.js";
import {
  resolveReadProjectId,
  resolveReadProjectIdWithSession,
} from "../lib/read-project-request.js";
import {
  EVENT_SORT_SQL,
  eventListOrderBy,
  overviewErrorOrderBy,
  parseEventListSortParam,
  parseListOrderParam,
  parseOverviewErrorSortParam,
  parseOverviewTopEventsSortParam,
  parseSessionListSortParam,
  sessionListOrderBy,
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
    const metricsWindow = effectiveOverviewWindow(timeRange);
    const appFilter = queryApp(query.app);
    const environment = queryString(query.environment);
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

    const [
      errorCounts,
      eventStats,
      errorsListTotal,
      errorGroups,
      eventCounts,
      series,
      sessionCounts,
      activeUserCounts,
      environments,
      sessionDurationSeries,
      activeIssues,
    ] = await Promise.all([
      getOverviewErrorCountsPair(prisma, windowParams),
      getOverviewEventWindowStats(prisma, windowParams),
      prisma.errorGroup.count({ where: errorGroupWhere }),
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
        since,
        until,
        timeRange.bucket,
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
        timeRange.bucket,
        since,
        until,
        appFilter,
        environment
      ),
      listActiveIssues(prisma, listScope),
    ]);

    const errorsCount = errorCounts.current;
    const errorsPrevious = errorCounts.previous;
    const eventsCount = eventStats.eventsCount;
    const eventsPrevious = eventStats.eventsPrevious;
    const eventsListTotal = eventStats.distinctEventNames;
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
      timeRange.bucketSeconds
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
      bucket: timeRange.bucket,
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
      eventsListTotal,
      errorsPage,
      eventsPage,
      listPageSize,
      series,
      sessionDurationSeries,
    });
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
      q?: string;
      status?: string;
      sort?: string;
      order?: string;
      trendWindow?: string;
      trendFrom?: string;
      trendTo?: string;
    };
    const pageSize = parseListPageSize(query.pageSize, query.limit);
    const page = parsePositivePage(query.page, 1);
    const skip = (page - 1) * pageSize;
    const appId = queryApp(query.app);
    const environment = queryString(query.environment);
    const q = queryString(query.q);
    const status = queryString(query.status) ?? "all";
    const range = parseCreatedRange(query, "all");

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
      q,
      range,
      status:
        status === "unresolved"
          ? "unresolved"
          : status === "resolved"
            ? "resolved"
            : "all",
    };

    if (isAggregateSort(sortParsed.sort)) {
      const { total, rows } = await listErrorGroupsAggregated(
        prisma,
        filter,
        projectId,
        sortParsed.sort,
        orderParsed.order,
        trend.durationMs,
        trend.end,
        skip,
        pageSize
      );
      const items = rows.map((r) => serializeErrorGroupListItem(r));
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
      trend.end
    );
    const items = groups.map((g) => {
      const m = metrics.get(g.id);
      return {
        ...g,
        users_affected: m?.users_affected ?? 0,
        sessions_affected: m?.sessions_affected ?? 0,
        occurrences_recent: m?.occurrences_recent ?? 0,
        occurrences_previous: m?.occurrences_previous ?? 0,
        trend_ratio: m?.trend_ratio ?? 0,
      };
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
    return reply.send(group);
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
    const sortParsed = parseEventListSortParam(queryString(query.sort));
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
      return reply.send({ items: rows, total, page, pageSize });
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
    return reply.send({ items: list, total, page, pageSize });
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
      sort?: string;
      order?: string;
    };
    const pageSize = parseListPageSize(query.pageSize, query.limit);
    const page = parsePositivePage(query.page, 1);
    const skip = (page - 1) * pageSize;
    const appId = queryApp(query.app);
    const platform = queryString(query.platform);
    const range = parseCreatedRange(query, "all");
    const sortParsed = parseSessionListSortParam(queryString(query.sort));
    if (!sortParsed.ok) {
      return reply.status(400).send({ error: "Invalid sort" });
    }
    const orderParsed = parseListOrderParam(queryString(query.order));
    if (!orderParsed.ok) {
      return reply.status(400).send({ error: "Invalid order" });
    }
    const sessionOrderBy = sessionListOrderBy(sortParsed.sort, orderParsed.order);

    const where: Prisma.SessionWhereInput = whereSessionProject(projectId);
    if (appId) where.app = appId;
    if (platform) where.platform = platform;
    if (range.gte || range.lte) {
      where.started_at = {};
      if (range.gte) where.started_at.gte = range.gte;
      if (range.lte) where.started_at.lte = range.lte;
    }
    const [total, list] = await Promise.all([
      prisma.session.count({ where }),
      prisma.session.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: sessionOrderBy,
      }),
    ]);
    return reply.send({ items: list, total, page, pageSize });
  });

  app.get<{ Params: { id: string } }>("/sessions/:id", async (request, reply) => {
    const projectId = await resolveReadProjectId(request, reply);
    if (projectId === null) return;
    const { id } = request.params;
    const session = await prisma.session.findFirst({
      where: whereSessionById(id, projectId),
    });
    if (!session) return reply.status(404).send({ error: "Not found" });
    return reply.send(session);
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

    const [environments, platEvents, platSessions, relEvents] = await Promise.all([
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
    ]);

    const platforms = [
      ...new Set([
        ...platEvents.map((r) => r.platform).filter(Boolean) as string[],
        ...platSessions.map((r) => r.platform).filter(Boolean) as string[],
      ]),
    ].sort();
    const releases = relEvents
      .map((r) => r.release)
      .filter((x): x is string => x != null && x !== "")
      .sort();

    return reply.send({ environments, platforms, releases });
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
