import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";
import { PrismaClient, type Prisma } from "@prisma/client";
import { computeFingerprint, findOrCreateErrorGroup } from "../services/errors.js";

const prisma = new PrismaClient();

const eventSchema = z.object({
  app: z.string().min(1),
  platform: z.string().optional(),
  environment: z.string().optional(),
  release: z.string().optional(),
  name: z.string().min(1),
  user_id: z.string().optional(),
  session_id: z.string().optional(),
  anonymous_id: z.string().optional(),
  sdk_version: z.string().optional(),
  properties: z.record(z.unknown()).optional(),
});

const sessionSchema = z.object({
  session_id: z.string().min(1),
  app: z.string().min(1),
  platform: z.string().optional(),
  user_id: z.string().optional(),
  anonymous_id: z.string().optional(),
  sdk_version: z.string().optional(),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().optional().nullable(),
});

const errorSchema = z.object({
  app: z.string().min(1),
  platform: z.string().optional(),
  environment: z.string().optional(),
  message: z.string().min(1),
  stack: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  session_id: z.string().optional(),
  user_id: z.string().optional(),
  anonymous_id: z.string().optional(),
  sdk_version: z.string().optional(),
});

const batchSchema = z.object({
  events: z.array(eventSchema).max(100),
});

export async function ingestRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.post("/event", async (request, reply) => {
    const parsed = eventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const body = parsed.data;
    await prisma.event.create({
      data: {
        app: body.app,
        platform: body.platform ?? null,
        environment: body.environment ?? null,
        release: body.release ?? null,
        name: body.name,
        user_id: body.user_id ?? null,
        session_id: body.session_id ?? null,
        anonymous_id: body.anonymous_id ?? null,
        sdk_version: body.sdk_version ?? null,
        properties: (body.properties ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    return reply.status(204).send();
  });

  app.post("/session", async (request, reply) => {
    const parsed = sessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const body = parsed.data;
    const existing = await prisma.session.findFirst({
      where: { session_id: body.session_id, app: body.app },
      orderBy: { started_at: "desc" },
    });
    if (existing && body.ended_at) {
      await prisma.session.update({
        where: { id: existing.id },
        data: { ended_at: new Date(body.ended_at) },
      });
    } else if (!existing) {
      await prisma.session.create({
        data: {
          session_id: body.session_id,
          app: body.app,
          platform: body.platform ?? null,
          user_id: body.user_id ?? null,
          anonymous_id: body.anonymous_id ?? null,
          sdk_version: body.sdk_version ?? null,
          started_at: body.started_at ? new Date(body.started_at) : undefined,
        },
      });
    }
    return reply.status(204).send();
  });

  app.post("/batch", async (request, reply) => {
    const parsed = batchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    for (const body of parsed.data.events) {
      await prisma.event.create({
        data: {
          app: body.app,
          platform: body.platform ?? null,
          environment: body.environment ?? null,
          release: body.release ?? null,
          name: body.name,
          user_id: body.user_id ?? null,
          session_id: body.session_id ?? null,
          anonymous_id: body.anonymous_id ?? null,
          sdk_version: body.sdk_version ?? null,
          properties: (body.properties ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    }
    return reply.status(204).send();
  });

  app.post("/error", async (request, reply) => {
    const parsed = errorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const body = parsed.data;
    const fingerprint = computeFingerprint(body.message, body.stack);
    const errorGroup = await findOrCreateErrorGroup(prisma, {
      fingerprint,
      message: body.message,
      top_stack: body.stack?.split("\n")[0]?.trim() ?? null,
      app: body.app,
      environment: body.environment ?? null,
    });
    await prisma.errorOccurrence.create({
      data: {
        error_group_id: errorGroup.id,
        stack: body.stack ?? null,
        context: (body.context ?? undefined) as Prisma.InputJsonValue | undefined,
        session_id: body.session_id ?? null,
        user_id: body.user_id ?? null,
        anonymous_id: body.anonymous_id ?? null,
        sdk_version: body.sdk_version ?? null,
      },
    });
    return reply.status(204).send();
  });
}
