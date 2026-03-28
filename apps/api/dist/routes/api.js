import { Prisma, PrismaClient } from "@prisma/client";
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
        const where = appId ? { app: appId } : {};
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
        const where = {};
        const appId = queryApp(query.app);
        if (appId)
            where.app = appId;
        if (query.name)
            where.name = query.name;
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
    function parseSince(since) {
        if (!since)
            return null;
        if (since === "24h")
            return new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (since === "7d")
            return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const d = new Date(since);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    app.get("/sessions", async (request, reply) => {
        const query = request.query;
        const pageSize = parseListPageSize(query.pageSize, query.limit);
        const page = parsePositivePage(query.page, 1);
        const skip = (page - 1) * pageSize;
        const sinceDate = parseSince(query.since);
        const where = {};
        const appId = queryApp(query.app);
        if (appId)
            where.app = appId;
        if (sinceDate)
            where.started_at = { gte: sinceDate };
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
