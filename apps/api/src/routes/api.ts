import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Fastify can expose repeated query keys as `string[]`; normalize to a single trimmed app id. */
function queryApp(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const t = typeof raw === "string" ? raw.trim() : "";
  return t || undefined;
}

function parseRange(range?: string): { since: Date; previousSince: Date; label: string } {
  const hours = range === "7d" ? 7 * 24 : 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const previousSince = new Date(since.getTime() - hours * 60 * 60 * 1000);
  const label = range === "7d" ? "7d" : "24h";
  return { since, previousSince, label };
}

export async function apiRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.get("/overview", async (request, reply) => {
    const query = request.query as { range?: string; compare?: string; app?: string | string[] };
    const range = query.range === "7d" ? "7d" : "24h";
    const compare = query.compare === "true" || query.compare === "1";
    const appFilter = queryApp(query.app);
    const { since, previousSince, label } = parseRange(range);

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
    const previousErrorWhere = compare
      ? appFilter
        ? {
            created_at: { gte: previousSince, lt: since },
            error_group: { app: appFilter },
          }
        : { created_at: { gte: previousSince, lt: since } }
      : undefined;
    const previousEventWhere = compare
      ? appFilter
        ? {
            created_at: { gte: previousSince, lt: since },
            app: appFilter,
          }
        : { created_at: { gte: previousSince, lt: since } }
      : undefined;

    const [
      errorsCount,
      eventsCount,
      errorGroups,
      eventCounts,
      errorsPrevious,
      eventsPrevious,
    ] = await Promise.all([
      prisma.errorOccurrence.count({ where: errorOccurrenceWhere }),
      prisma.event.count({ where: eventWhere }),
      prisma.errorGroup.findMany({
        where: errorGroupWhere,
        take: 10,
        orderBy: { occurrences: "desc" },
        include: { _count: { select: { occurrences_list: true } } },
      }),
      prisma.event.groupBy({
        by: ["name"],
        where: eventWhere,
        _count: { name: true },
        orderBy: { _count: { name: "desc" } },
        take: 10,
      }),
      previousErrorWhere
        ? prisma.errorOccurrence.count({ where: previousErrorWhere })
        : Promise.resolve(null),
      previousEventWhere
        ? prisma.event.count({ where: previousEventWhere })
        : Promise.resolve(null),
    ]);

    const body: Record<string, unknown> = {
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
    const query = request.query as { app?: string | string[]; limit?: string };
    const limit = Math.min(Number(query.limit) || 50, 100);
    const appId = queryApp(query.app);
    const where = appId ? { app: appId } : {};
    const list = await prisma.errorGroup.findMany({
      where,
      take: limit,
      orderBy: { last_seen: "desc" },
      include: { _count: { select: { occurrences_list: true } } },
    });
    return reply.send({ items: list });
  });

  app.get<{ Params: { id: string } }>("/errors/:id", async (request, reply) => {
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
    if (!group) return reply.status(404).send({ error: "Not found" });
    return reply.send(group);
  });

  app.get("/events", async (request, reply) => {
    const query = request.query as { app?: string | string[]; limit?: string; name?: string };
    const limit = Math.min(Number(query.limit) || 50, 100);
    const where: { app?: string; name?: string } = {};
    const appId = queryApp(query.app);
    if (appId) where.app = appId;
    if (query.name) where.name = query.name;
    const list = await prisma.event.findMany({
      where,
      take: limit,
      orderBy: { created_at: "desc" },
    });
    return reply.send({ items: list });
  });

  app.get<{ Params: { id: string } }>("/events/:id", async (request, reply) => {
    const { id } = request.params;
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) return reply.status(404).send({ error: "Not found" });
    return reply.send(event);
  });

  function parseSince(since?: string): Date | null {
    if (!since) return null;
    if (since === "24h") return new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (since === "7d") return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const d = new Date(since);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  app.get("/sessions", async (request, reply) => {
    const query = request.query as { app?: string | string[]; limit?: string; since?: string };
    const limit = Math.min(Number(query.limit) || 50, 100);
    const sinceDate = parseSince(query.since);
    const where: { app?: string; started_at?: { gte: Date } } = {};
    const appId = queryApp(query.app);
    if (appId) where.app = appId;
    if (sinceDate) where.started_at = { gte: sinceDate };
    const list = await prisma.session.findMany({
      where,
      take: limit,
      orderBy: { started_at: "desc" },
    });
    return reply.send({ items: list });
  });

  app.get<{ Params: { id: string } }>("/sessions/:id", async (request, reply) => {
    const { id } = request.params;
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) return reply.status(404).send({ error: "Not found" });
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
