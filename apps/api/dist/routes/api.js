import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
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
        const compare = query.compare === "true" || query.compare === "1";
        const { since, previousSince, label } = parseRange(range);
        const [errorsCount, eventsCount, errorGroups, eventCounts, errorsPrevious, eventsPrevious,] = await Promise.all([
            prisma.errorOccurrence.count({ where: { created_at: { gte: since } } }),
            prisma.event.count({ where: { created_at: { gte: since } } }),
            prisma.errorGroup.findMany({
                where: { last_seen: { gte: since } },
                take: 10,
                orderBy: { occurrences: "desc" },
                include: { _count: { select: { occurrences_list: true } } },
            }),
            prisma.event.groupBy({
                by: ["name"],
                where: { created_at: { gte: since } },
                _count: { name: true },
                orderBy: { _count: { name: "desc" } },
                take: 10,
            }),
            compare
                ? prisma.errorOccurrence.count({
                    where: {
                        created_at: { gte: previousSince, lt: since },
                    },
                })
                : Promise.resolve(null),
            compare
                ? prisma.event.count({
                    where: {
                        created_at: { gte: previousSince, lt: since },
                    },
                })
                : Promise.resolve(null),
        ]);
        const body = {
            range: label,
            since: since.toISOString(),
            errorsLast24h: errorsCount,
            eventsLast24h: eventsCount,
            topErrorGroups: errorGroups,
            topEvents: eventCounts.map((e) => ({ name: e.name, count: e._count.name })),
        };
        if (compare) {
            body.errorsPrevious = errorsPrevious;
            body.eventsPrevious = eventsPrevious;
        }
        return reply.send(body);
    });
    app.get("/errors", async (request, reply) => {
        const query = request.query;
        const limit = Math.min(Number(query.limit) || 50, 100);
        const where = query.app ? { app: query.app } : {};
        const list = await prisma.errorGroup.findMany({
            where,
            take: limit,
            orderBy: { last_seen: "desc" },
            include: { _count: { select: { occurrences_list: true } } },
        });
        return reply.send({ items: list });
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
        const limit = Math.min(Number(query.limit) || 50, 100);
        const where = {};
        if (query.app)
            where.app = query.app;
        if (query.name)
            where.name = query.name;
        const list = await prisma.event.findMany({
            where,
            take: limit,
            orderBy: { created_at: "desc" },
        });
        return reply.send({ items: list });
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
        const limit = Math.min(Number(query.limit) || 50, 100);
        const sinceDate = parseSince(query.since);
        const where = {};
        if (query.app)
            where.app = query.app;
        if (sinceDate)
            where.started_at = { gte: sinceDate };
        const list = await prisma.session.findMany({
            where,
            take: limit,
            orderBy: { started_at: "desc" },
        });
        return reply.send({ items: list });
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
