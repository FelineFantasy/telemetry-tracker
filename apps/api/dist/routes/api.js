import { Prisma, PrismaClient } from "@prisma/client";
import { parseCreatedRange } from "../lib/list-query.js";
import { buildEventWhereSql } from "../lib/list-query-helpers.js";
const prisma = new PrismaClient();
const DEFAULT_LIST_PAGE_SIZE = 20;
const MAX_LIST_PAGE_SIZE = 100;
const OVERVIEW_LIST_PAGE_SIZE = 10;
const MAX_OVERVIEW_LIST_PAGE_SIZE = 50;
function parsePositivePage(value, fallback) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n >= 1 ? n : fallback;
}
function parseListPageSize(pageSize, limit, fallback = DEFAULT_LIST_PAGE_SIZE) {
    const raw = pageSize ?? limit;
    const n = Math.floor(Number(raw));
    const v = Number.isFinite(n) && n >= 1 ? n : fallback;
    return Math.min(MAX_LIST_PAGE_SIZE, Math.max(1, v));
}
async function countDistinctEventNames(since, appFilter) {
    if (appFilter) {
        const r = await prisma.$queryRaw(Prisma.sql `SELECT COUNT(*)::bigint AS c FROM (
        SELECT name FROM "Event" WHERE created_at >= ${since} AND app = ${appFilter}
        GROUP BY name
      ) t`);
        return Number(r[0]?.c ?? 0);
    }
    const r = await prisma.$queryRaw(Prisma.sql `SELECT COUNT(*)::bigint AS c FROM (
      SELECT name FROM "Event" WHERE created_at >= ${since}
      GROUP BY name
    ) t`);
    return Number(r[0]?.c ?? 0);
}
/** Fastify can expose repeated query keys as `string[]`; normalize to a single trimmed app id. */
function queryApp(value) {
    if (value === undefined)
        return undefined;
    const raw = Array.isArray(value) ? value[0] : value;
    const t = typeof raw === "string" ? raw.trim() : "";
    return t || undefined;
}
function queryString(value) {
    if (value === undefined)
        return undefined;
    const raw = Array.isArray(value) ? value[0] : value;
    const t = typeof raw === "string" ? raw.trim() : "";
    return t || undefined;
}
function parseRange(range) {
    const hours = range === "7d" ? 7 * 24 : 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const previousSince = new Date(since.getTime() - hours * 60 * 60 * 1000);
    const label = range === "7d" ? "7d" : "24h";
    return { since, previousSince, label };
}
export async function apiRoutes(app, _opts) {
    app.get("/overview", async (request, reply) => {
        const query = request.query;
        const range = query.range === "7d" ? "7d" : "24h";
        const appFilter = queryApp(query.app);
        const { since, previousSince, label } = parseRange(range);
        const listPageSize = Math.min(MAX_OVERVIEW_LIST_PAGE_SIZE, Math.max(1, Math.floor(Number(query.listPageSize)) || OVERVIEW_LIST_PAGE_SIZE));
        const errorsPage = parsePositivePage(query.errorsPage, 1);
        const eventsPage = parsePositivePage(query.eventsPage, 1);
        const errorsSkip = (errorsPage - 1) * listPageSize;
        const eventsSkip = (eventsPage - 1) * listPageSize;
        const baseWhere = { created_at: { gte: since } };
        const eventWhere = appFilter
            ? { ...baseWhere, app: appFilter }
            : baseWhere;
        const errorGroupWhere = appFilter
            ? { last_seen: { gte: since }, app: appFilter }
            : { last_seen: { gte: since } };
        const errorOccurrenceWhere = appFilter
            ? { created_at: { gte: since }, error_group: { app: appFilter } }
            : { created_at: { gte: since } };
        const previousErrorWhere = appFilter
            ? {
                created_at: { gte: previousSince, lt: since },
                error_group: { app: appFilter },
            }
            : { created_at: { gte: previousSince, lt: since } };
        const previousEventWhere = appFilter
            ? {
                created_at: { gte: previousSince, lt: since },
                app: appFilter,
            }
            : { created_at: { gte: previousSince, lt: since } };
        const [errorsCount, eventsCount, errorsListTotal, eventsListTotal, errorGroups, eventCounts, errorsPrevious, eventsPrevious,] = await Promise.all([
            prisma.errorOccurrence.count({ where: errorOccurrenceWhere }),
            prisma.event.count({ where: eventWhere }),
            prisma.errorGroup.count({ where: errorGroupWhere }),
            countDistinctEventNames(since, appFilter),
            prisma.errorGroup.findMany({
                where: errorGroupWhere,
                skip: errorsSkip,
                take: listPageSize,
                orderBy: { occurrences: "desc" },
                include: { _count: { select: { occurrences_list: true } } },
            }),
            prisma.event.groupBy({
                by: ["name"],
                where: eventWhere,
                _count: { name: true },
                orderBy: { _count: { name: "desc" } },
                skip: eventsSkip,
                take: listPageSize,
            }),
            prisma.errorOccurrence.count({ where: previousErrorWhere }),
            prisma.event.count({ where: previousEventWhere }),
        ]);
        const topEvents = await Promise.all(eventCounts.map(async (row) => {
            const latest = await prisma.event.findFirst({
                where: { ...eventWhere, name: row.name },
                orderBy: { created_at: "desc" },
                select: {
                    app: true,
                    platform: true,
                    environment: true,
                    release: true,
                    created_at: true,
                },
            });
            return {
                name: row.name,
                count: row._count.name,
                app: latest?.app ?? "",
                platform: latest?.platform ?? null,
                environment: latest?.environment ?? null,
                release: latest?.release ?? null,
                lastSeen: latest?.created_at.toISOString() ?? null,
            };
        }));
        return reply.send({
            range: label,
            since: since.toISOString(),
            errorsLast24h: errorsCount,
            eventsLast24h: eventsCount,
            errorsPrevious,
            eventsPrevious,
            topErrorGroups: errorGroups,
            topEvents,
            errorsListTotal,
            eventsListTotal,
            errorsPage,
            eventsPage,
            listPageSize,
        });
    });
    app.get("/errors", async (request, reply) => {
        const query = request.query;
        const pageSize = parseListPageSize(query.pageSize, query.limit);
        const page = parsePositivePage(query.page, 1);
        const skip = (page - 1) * pageSize;
        const appId = queryApp(query.app);
        const environment = queryString(query.environment);
        const q = queryString(query.q);
        const status = queryString(query.status) ?? "all";
        const range = parseCreatedRange(query, "all");
        const where = {};
        if (appId)
            where.app = appId;
        if (environment)
            where.environment = environment;
        if (q) {
            where.message = { contains: q, mode: "insensitive" };
        }
        if (range.gte || range.lte) {
            where.last_seen = {};
            if (range.gte)
                where.last_seen.gte = range.gte;
            if (range.lte)
                where.last_seen.lte = range.lte;
        }
        if (status === "unresolved")
            where.resolved_at = null;
        if (status === "resolved")
            where.resolved_at = { not: null };
        const [total, list] = await Promise.all([
            prisma.errorGroup.count({ where }),
            prisma.errorGroup.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { last_seen: "desc" },
                include: { _count: { select: { occurrences_list: true } } },
            }),
        ]);
        return reply.send({ items: list, total, page, pageSize });
    });
    app.patch("/errors/:id", async (request, reply) => {
        const body = request.body;
        if (typeof body?.resolved !== "boolean") {
            return reply.status(400).send({ error: "Body must be JSON with resolved: boolean" });
        }
        try {
            const group = await prisma.errorGroup.update({
                where: { id: request.params.id },
                data: { resolved_at: body.resolved ? new Date() : null },
            });
            return reply.send(group);
        }
        catch {
            return reply.status(404).send({ error: "Not found" });
        }
    });
    app.get("/errors/:id", async (request, reply) => {
        const { id } = request.params;
        const group = await prisma.errorGroup.findUnique({
            where: { id },
            include: {
                occurrences_list: {
                    orderBy: { created_at: "desc" },
                    take: 50,
                },
            },
        });
        if (!group)
            return reply.status(404).send({ error: "Not found" });
        return reply.send(group);
    });
    app.get("/events", async (request, reply) => {
        const query = request.query;
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
        const props = propertiesContains?.trim();
        if (props) {
            const whereSql = buildEventWhereSql({
                appId,
                name,
                environment,
                platform,
                release,
                gte: range.gte,
                lte: range.lte,
                propertiesContains: props,
            });
            const [countRow, rows] = await Promise.all([
                prisma.$queryRaw(Prisma.sql `SELECT COUNT(*)::bigint AS c FROM "Event" WHERE ${whereSql}`),
                prisma.$queryRaw(Prisma.sql `SELECT * FROM "Event" WHERE ${whereSql} ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${skip}`),
            ]);
            const total = Number(countRow[0]?.c ?? 0);
            return reply.send({ items: rows, total, page, pageSize });
        }
        const where = {};
        if (appId)
            where.app = appId;
        if (name)
            where.name = name;
        if (environment)
            where.environment = environment;
        if (platform)
            where.platform = platform;
        if (release)
            where.release = release;
        if (range.gte || range.lte) {
            where.created_at = {};
            if (range.gte)
                where.created_at.gte = range.gte;
            if (range.lte)
                where.created_at.lte = range.lte;
        }
        const [total, list] = await Promise.all([
            prisma.event.count({ where }),
            prisma.event.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { created_at: "desc" },
            }),
        ]);
        return reply.send({ items: list, total, page, pageSize });
    });
    app.get("/events/:id", async (request, reply) => {
        const { id } = request.params;
        const event = await prisma.event.findUnique({ where: { id } });
        if (!event)
            return reply.status(404).send({ error: "Not found" });
        return reply.send(event);
    });
    app.get("/sessions", async (request, reply) => {
        const query = request.query;
        const pageSize = parseListPageSize(query.pageSize, query.limit);
        const page = parsePositivePage(query.page, 1);
        const skip = (page - 1) * pageSize;
        const appId = queryApp(query.app);
        const platform = queryString(query.platform);
        const range = parseCreatedRange(query, "24h");
        const where = {};
        if (appId)
            where.app = appId;
        if (platform)
            where.platform = platform;
        if (range.gte || range.lte) {
            where.started_at = {};
            if (range.gte)
                where.started_at.gte = range.gte;
            if (range.lte)
                where.started_at.lte = range.lte;
        }
        const [total, list] = await Promise.all([
            prisma.session.count({ where }),
            prisma.session.findMany({
                where,
                skip,
                take: pageSize,
                orderBy: { started_at: "desc" },
            }),
        ]);
        return reply.send({ items: list, total, page, pageSize });
    });
    app.get("/sessions/:id", async (request, reply) => {
        const { id } = request.params;
        const session = await prisma.session.findUnique({ where: { id } });
        if (!session)
            return reply.status(404).send({ error: "Not found" });
        return reply.send(session);
    });
    app.get("/filter-options", async (request, reply) => {
        const appFilter = queryApp(request.query.app);
        const baseEvent = appFilter ? { app: appFilter } : {};
        const baseSession = appFilter ? { app: appFilter } : {};
        const baseError = appFilter ? { app: appFilter } : {};
        const [envEvents, envErrors, platEvents, platSessions, relEvents,] = await Promise.all([
            prisma.event.groupBy({
                by: ["environment"],
                where: { ...baseEvent, environment: { not: null } },
            }),
            prisma.errorGroup.groupBy({
                by: ["environment"],
                where: { ...baseError, environment: { not: null } },
            }),
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
        const environments = [
            ...new Set([
                ...envEvents.map((r) => r.environment).filter(Boolean),
                ...envErrors.map((r) => r.environment).filter(Boolean),
            ]),
        ].sort();
        const platforms = [
            ...new Set([
                ...platEvents.map((r) => r.platform).filter(Boolean),
                ...platSessions.map((r) => r.platform).filter(Boolean),
            ]),
        ].sort();
        const releases = relEvents
            .map((r) => r.release)
            .filter((x) => x != null && x !== "")
            .sort();
        return reply.send({ environments, platforms, releases });
    });
    app.get("/apps", async (_request, reply) => {
        const [eventsApps, errorsApps, sessionsApps] = await Promise.all([
            prisma.event.groupBy({ by: ["app"] }),
            prisma.errorGroup.groupBy({ by: ["app"] }),
            prisma.session.groupBy({ by: ["app"] }),
        ]);
        const apps = [
            ...new Set([
                ...eventsApps.map((e) => e.app),
                ...errorsApps.map((e) => e.app),
                ...sessionsApps.map((s) => s.app),
            ]),
        ].sort();
        return reply.send({ apps });
    });
}
