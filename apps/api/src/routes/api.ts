import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function apiRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  app.get("/overview", async (_request, reply) => {
    const [errorsCount, eventsCount, errorGroups, eventCounts] =
      await Promise.all([
        prisma.errorOccurrence.count({ where: { created_at: { gte: since24h } } }),
        prisma.event.count({ where: { created_at: { gte: since24h } } }),
        prisma.errorGroup.findMany({
          take: 10,
          orderBy: { occurrences: "desc" },
          include: { _count: { select: { occurrences_list: true } } },
        }),
        prisma.event.groupBy({
          by: ["name"],
          where: { created_at: { gte: since24h } },
          _count: { name: true },
          orderBy: { _count: { name: "desc" } },
          take: 10,
        }),
      ]);
    return reply.send({
      errorsLast24h: errorsCount,
      eventsLast24h: eventsCount,
      topErrorGroups: errorGroups,
      topEvents: eventCounts.map((e) => ({ name: e.name, count: e._count.name })),
    });
  });

  app.get("/errors", async (request, reply) => {
    const query = request.query as { app?: string; limit?: string };
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
    const query = request.query as { app?: string; limit?: string; name?: string };
    const limit = Math.min(Number(query.limit) || 50, 100);
    const where: { app?: string; name?: string } = {};
    if (query.app) where.app = query.app;
    if (query.name) where.name = query.name;
    const list = await prisma.event.findMany({
      where,
      take: limit,
      orderBy: { created_at: "desc" },
    });
    return reply.send({ items: list });
  });
}
