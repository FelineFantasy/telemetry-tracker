import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { prisma } from "../lib/db.js";
import { hashApiKeySecret } from "../lib/api-key-auth.js";
import { resolveReadProjectId } from "../lib/read-project-request.js";

const DEFAULT_ORG_ID =
  process.env.TELEMETRY_ORGANIZATION_ID?.trim() ||
  "a0000000-0000-4000-8000-000000000001";

/**
 * Dashboard-only routes: project list + API key lifecycle (no end-user auth yet).
 */
export async function projectDashboardRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  app.get("/meta/projects", async (_request, reply) => {
    const projects = await prisma.project.findMany({
      where: { organization_id: DEFAULT_ORG_ID, deleted_at: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
    return reply.send({ projects });
  });

  app.get("/project/api-keys", async (request, reply) => {
    const projectId = await resolveReadProjectId(request);
    const keys = await prisma.apiKey.findMany({
      where: { project_id: projectId, deleted_at: null },
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        public_id: true,
        name: true,
        created_at: true,
        last_used_at: true,
        revoked_at: true,
        expires_at: true,
      },
    });
    return reply.send({
      keys: keys.map((k) => ({
        id: k.id,
        publicId: k.public_id,
        name: k.name,
        createdAt: k.created_at.toISOString(),
        lastUsedAt: k.last_used_at?.toISOString() ?? null,
        revokedAt: k.revoked_at?.toISOString() ?? null,
        expiresAt: k.expires_at?.toISOString() ?? null,
      })),
    });
  });

  app.post("/project/api-keys", async (request, reply) => {
    const projectId = await resolveReadProjectId(request);
    const body = (request.body ?? {}) as { name?: string };
    const name =
      typeof body.name === "string" && body.name.trim() !== ""
        ? body.name.trim().slice(0, 120)
        : null;

    const publicId = randomBytes(16).toString("hex");
    const secret = randomBytes(32).toString("hex");
    const secretHash = hashApiKeySecret(publicId, secret);
    const fullKey = `tt_live_${publicId}_${secret}`;

    await prisma.apiKey.create({
      data: {
        project_id: projectId,
        public_id: publicId,
        secret_hash: secretHash,
        name,
      },
    });

    return reply.status(201).send({
      key: fullKey,
      publicId,
      name,
      message:
        "Copy this key now. It will not be shown again. Store it as a secret (e.g. environment variable).",
    });
  });

  app.post<{ Params: { publicId: string } }>(
    "/project/api-keys/:publicId/revoke",
    async (request, reply) => {
      const projectId = await resolveReadProjectId(request);
      const publicId = request.params.publicId.toLowerCase();
      if (!/^[a-f0-9]{32}$/.test(publicId)) {
        return reply.status(400).send({ error: "Invalid publicId" });
      }
      const r = await prisma.apiKey.updateMany({
        where: {
          project_id: projectId,
          public_id: publicId,
          deleted_at: null,
        },
        data: { revoked_at: new Date() },
      });
      if (r.count === 0) {
        return reply.status(404).send({ error: "Key not found" });
      }
      return reply.status(204).send();
    }
  );
}
