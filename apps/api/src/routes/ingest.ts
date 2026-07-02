import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/db.js";
import { createIngestAuthPreHandler, requireIngestProjectId } from "../middleware/ingest-auth.js";
import { assertIngestPlanOrReply } from "../lib/plan-enforcement.js";
import { addIngestUnits } from "../lib/usage-meter.js";
import { notifyNewErrorGroupEmail } from "../lib/notification-email-dispatch.js";
import { maybeNotifyErrorSpike } from "../lib/error-spike-alert.js";
import { maybeNotifyQuotaAlerts } from "../lib/quota-alert.js";
import { computeFingerprint, findOrCreateErrorGroup } from "../services/errors.js";
import { findIngestSession } from "../lib/ingest-session.js";
import {
  ingestAppSchema,
  normalizeMapAppLabel,
  normalizeMapReleaseLabel,
} from "../lib/source-map-artifact.js";

/**
 * Ingest pipeline (implement in order):
 * 1. Organization / 2. Project / 3. ApiKey — Prisma schema
 * 4. Ingest auth middleware — `createIngestAuthPreHandler`
 * 5. `project_id` on all writes — below
 * 6. Usage metering — `addIngestUnits` (basic monthly rollup)
 */

const eventSchema = z.object({
  app: ingestAppSchema,
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
  app: ingestAppSchema,
  platform: z.string().optional(),
  user_id: z.string().optional(),
  anonymous_id: z.string().optional(),
  sdk_version: z.string().optional(),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().optional().nullable(),
});

const errorSchema = z.object({
  app: ingestAppSchema,
  platform: z.string().optional(),
  environment: z.string().optional(),
  release: z.string().optional(),
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

const APP_RESTRICT_MSG =
  "This API key is restricted to a specific app label; send a matching `app` field.";

function assertIngestAppAllowed(
  request: FastifyRequest,
  app: string,
  reply: FastifyReply
): boolean {
  const allowed = request.ingestApiKeyAllowedApp;
  if (allowed == null) return true;
  if (normalizeMapAppLabel(app) !== normalizeMapAppLabel(allowed)) {
    void reply.status(403).send({ error: APP_RESTRICT_MSG });
    return false;
  }
  return true;
}

export async function ingestRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.addHook("preHandler", createIngestAuthPreHandler(prisma));

  app.post("/event", async (request, reply) => {
    const projectId = requireIngestProjectId(request);
    const parsed = eventSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const body = parsed.data;
    const app = body.app;
    if (!assertIngestAppAllowed(request, app, reply)) return;
    const planOk = await assertIngestPlanOrReply(prisma, projectId, 1, [app]);
    if (!planOk.ok) return reply.status(planOk.status).send(planOk.body);
    await prisma.event.create({
      data: {
        project_id: projectId,
        app,
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
    await addIngestUnits(prisma, projectId, 1);
    void maybeNotifyQuotaAlerts(prisma, projectId);
    return reply.status(204).send();
  });

  app.post("/session", async (request, reply) => {
    const projectId = requireIngestProjectId(request);
    const parsed = sessionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const body = parsed.data;
    const app = body.app;
    if (!assertIngestAppAllowed(request, app, reply)) return;
    const existing = await findIngestSession(prisma, projectId, body.session_id, app);
    // Closing a session only sets `ended_at` — no new telemetry; must not be blocked by quota.
    if (existing && body.ended_at) {
      await prisma.session.update({
        where: { id: existing.id },
        data: {
          ended_at: new Date(body.ended_at),
          ...(existing.app !== app ? { app } : {}),
        },
      });
      return reply.status(204).send();
    }
    // Same session already recorded, no end time — idempotent retry; nothing to write, bill, or quota-check.
    if (existing && body.ended_at == null) {
      return reply.status(204).send();
    }
    const planOk = await assertIngestPlanOrReply(prisma, projectId, 1, [app]);
    if (!planOk.ok) return reply.status(planOk.status).send(planOk.body);
    if (!existing) {
      await prisma.session.create({
        data: {
          project_id: projectId,
          session_id: body.session_id,
          app,
          platform: body.platform ?? null,
          user_id: body.user_id ?? null,
          anonymous_id: body.anonymous_id ?? null,
          sdk_version: body.sdk_version ?? null,
          started_at: body.started_at ? new Date(body.started_at) : undefined,
        },
      });
    }
    await addIngestUnits(prisma, projectId, 1);
    void maybeNotifyQuotaAlerts(prisma, projectId);
    return reply.status(204).send();
  });

  app.post("/batch", async (request, reply) => {
    const projectId = requireIngestProjectId(request);
    const parsed = batchSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const n = parsed.data.events.length;
    for (const ev of parsed.data.events) {
      if (!assertIngestAppAllowed(request, ev.app, reply)) return;
    }
    const batchApps = parsed.data.events.map((e) => e.app);
    const planOk = await assertIngestPlanOrReply(prisma, projectId, n, batchApps);
    if (!planOk.ok) return reply.status(planOk.status).send(planOk.body);
    for (const body of parsed.data.events) {
      await prisma.event.create({
        data: {
          project_id: projectId,
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
    await addIngestUnits(prisma, projectId, n);
    void maybeNotifyQuotaAlerts(prisma, projectId);
    return reply.status(204).send();
  });

  app.post("/error", async (request, reply) => {
    const projectId = requireIngestProjectId(request);
    const parsed = errorSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const body = parsed.data;
    const app = body.app;
    const release = normalizeMapReleaseLabel(body.release);
    if (!assertIngestAppAllowed(request, app, reply)) return;
    const planOk = await assertIngestPlanOrReply(prisma, projectId, 1, [app]);
    if (!planOk.ok) return reply.status(planOk.status).send(planOk.body);
    const fingerprint = computeFingerprint(body.message, body.stack);
    const { group: errorGroup, isNew } = await findOrCreateErrorGroup(prisma, {
      projectId,
      fingerprint,
      message: body.message,
      top_stack: body.stack?.split("\n")[0]?.trim() ?? null,
      app,
      environment: body.environment ?? null,
      release,
    });
    await prisma.errorOccurrence.create({
      data: {
        error_group_id: errorGroup.id,
        stack: body.stack ?? null,
        release,
        context: (body.context ?? undefined) as Prisma.InputJsonValue | undefined,
        session_id: body.session_id ?? null,
        user_id: body.user_id ?? null,
        anonymous_id: body.anonymous_id ?? null,
        sdk_version: body.sdk_version ?? null,
      },
    });
    await addIngestUnits(prisma, projectId, 1);
    if (isNew) {
      void notifyNewErrorGroupEmail(prisma, projectId, errorGroup);
    }
    void maybeNotifyErrorSpike(prisma, projectId);
    void maybeNotifyQuotaAlerts(prisma, projectId);
    return reply.status(204).send();
  });
}
