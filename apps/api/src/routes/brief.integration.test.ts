import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { OrgRole } from "@prisma/client";
import { createApp } from "../app.js";
import { hashPassword } from "../lib/password.js";
import { prisma } from "../lib/db.js";
import { floorToCompletedMinute } from "../lib/brief-request-until.js";
import { processNextBriefGenerationJob } from "../lib/brief-worker.js";

const runBriefIntegration = process.env.RUN_BRIEF_INTEGRATION_TESTS === "true";
const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";
const TEST_SECRET_B64 = Buffer.alloc(32, 7).toString("base64");

const aiRepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../telemetry-tracker-ai"
);

async function startAiStub(): Promise<{ app: FastifyInstance; baseUrl: string }> {
  const { loadBriefServiceConfig, createBriefServiceRuntime } = await import(
    path.join(aiRepoRoot, "src/config.js")
  );
  const { buildServer } = await import(path.join(aiRepoRoot, "src/server.js"));

  const config = loadBriefServiceConfig({
    NODE_ENV: "test",
    BRIEF_SERVICE_SECRET: TEST_SECRET_B64,
  });
  const runtime = createBriefServiceRuntime(config);
  const app = await buildServer({ runtime });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve AI stub port");
  }
  return { app, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe.skipIf(!runBriefIntegration || !runDbIntegration)(
  "workspace brief routes (integration)",
  { hookTimeout: 120_000, timeout: 120_000 },
  () => {
    let app: FastifyInstance | undefined;
    let aiApp: FastifyInstance | undefined;
    let organizationId: string;
    let projectId: string;
    let email: string;
    const password = "testpass12";
    const suffix = randomBytes(6).toString("hex");
    let sessionId = "";

    beforeAll(async () => {
      const stub = await startAiStub();
      aiApp = stub.app;
      process.env.TELEMETRY_AI_BRIEF_URL = stub.baseUrl;
      process.env.TELEMETRY_AI_BRIEF_SECRET = TEST_SECRET_B64;

      email = `brief-${suffix}@test.local`;
      const org = await prisma.organization.create({
        data: {
          name: `Brief integration org ${suffix}`,
          projects: {
            create: {
              name: "Brief project",
              slug: `brief-${suffix}`,
            },
          },
        },
        include: { projects: true },
      });
      organizationId = org.id;
      projectId = org.projects[0]!.id;

      await prisma.user.create({
        data: {
          email,
          password_hash: hashPassword(password),
          memberships: {
            create: {
              organization_id: organizationId,
              role: OrgRole.VIEWER,
            },
          },
        },
      });

      app = await createApp();

      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { "content-type": "application/json" },
        payload: { email, password },
      });
      expect(login.statusCode).toBe(200);
      sessionId = (JSON.parse(login.body) as { sessionId: string }).sessionId;
    });

    afterAll(async () => {
      if (app) await app.close();
      if (aiApp) await aiApp.close();
      if (organizationId) {
        await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
      }
      if (email) {
        await prisma.user.deleteMany({ where: { email } }).catch(() => {});
      }
      delete process.env.TELEMETRY_AI_BRIEF_URL;
      delete process.env.TELEMETRY_AI_BRIEF_SECRET;
    });

    it("returns unavailable fallback before the worker completes a job", async () => {
      const res = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/workspace",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        status: string;
        meta?: { byteLength?: number };
        fallback?: { schemaVersion?: string };
      };
      expect(body.status).toBe("unavailable");
      expect(body.fallback?.schemaVersion).toBe("2026-07-brief-fallback-v1");
      expect(body.meta?.byteLength).toBeGreaterThan(0);
    });

    it("serves a completed brief from Postgres after the worker runs", async () => {
      const workerResult = await processNextBriefGenerationJob({ prisma });
      expect(workerResult.status).toBe("completed");

      const res = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/workspace",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body) as {
        status: string;
        requestId?: string;
        meta?: { source?: string };
      };
      expect(body.status).toBe("ok");
      expect(body.meta?.source).toBe("ai");
      expect(body.requestId).toBe(workerResult.requestId);
    });

    it("reuses the stored requestId across polls in the same bucket", async () => {
      await processNextBriefGenerationJob({ prisma });

      const first = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/workspace",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {},
      });
      const second = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/workspace",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {},
      });

      const firstBody = JSON.parse(first.body) as {
        status: string;
        requestId?: string;
        contentHash?: string;
        meta?: { source?: string };
      };
      const secondBody = JSON.parse(second.body) as {
        status: string;
        requestId?: string;
        contentHash?: string;
        meta?: { source?: string };
      };

      expect(firstBody.status).toBe("ok");
      expect(secondBody.status).toBe("ok");
      expect(secondBody.contentHash).toBe(firstBody.contentHash);
      expect(secondBody.requestId).toBe(firstBody.requestId);
      expect(secondBody.meta?.source).toBe("ai");
    });

    it("uses the same contentHash within a completed-minute bucket", async () => {
      const bucketUntil = floorToCompletedMinute(new Date());
      const first = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/workspace",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {},
      });
      const second = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/workspace",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {},
      });

      const firstBody = JSON.parse(first.body) as { contentHash?: string };
      const secondBody = JSON.parse(second.body) as { contentHash?: string };
      expect(firstBody.contentHash).toBe(secondBody.contentHash);
      expect(bucketUntil.toISOString()).toMatch(/:00\.000Z$/);
    });

    it("returns 409 stale_brief when acknowledging a DB-served brief before Async-C served-meta", async () => {
      await processNextBriefGenerationJob({ prisma });

      const brief = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/workspace",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {},
      });
      const briefBody = JSON.parse(brief.body) as {
        status: string;
        requestId: string;
        snapshotHash: string;
        brief: { projects: Array<{ projectId: string; generatedThrough: string }> };
      };
      expect(briefBody.status).toBe("ok");

      const ack = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/ack",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {
          requestId: briefBody.requestId,
          snapshotHash: briefBody.snapshotHash,
          projects: briefBody.brief.projects.map((p) => ({
            projectId: p.projectId,
            acknowledgedThrough: p.generatedThrough,
          })),
        },
      });

      expect(ack.statusCode).toBe(409);
      const ackBody = JSON.parse(ack.body) as { ok: boolean; error?: string };
      expect(ackBody.ok).toBe(false);
      expect(ackBody.error).toBe("stale_brief");
    });

    it("returns 409 stale_brief when acknowledging an unavailable fallback brief", async () => {
      const brief = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/workspace",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {},
      });

      expect(brief.statusCode).toBe(200);
      const briefBody = JSON.parse(brief.body) as {
        status: string;
        requestId: string;
        snapshotHash: string;
        fallback: {
          projects: Array<{ projectId: string; generatedThrough: string }>;
        };
      };
      expect(briefBody.status).toBe("unavailable");

      const ack = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/ack",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {
          requestId: briefBody.requestId,
          snapshotHash: briefBody.snapshotHash,
          projects: briefBody.fallback.projects.map((p) => ({
            projectId: p.projectId,
            acknowledgedThrough: p.generatedThrough,
          })),
        },
      });

      expect(ack.statusCode).toBe(409);
      const ackBody = JSON.parse(ack.body) as { ok: boolean; error?: string };
      expect(ackBody.ok).toBe(false);
      expect(ackBody.error).toBe("stale_brief");
    });

    it("returns 403 when the user is no longer an organization member", async () => {
      const brief = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/workspace",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {},
      });
      const briefBody = JSON.parse(brief.body) as {
        status: string;
        requestId: string;
        snapshotHash: string;
        brief: { projects: Array<{ projectId: string; generatedThrough: string }> };
      };
      expect(briefBody.status).toBe("ok");

      const user = await prisma.user.findFirstOrThrow({ where: { email } });
      await prisma.organizationMembership.deleteMany({
        where: {
          user_id: user.id,
          organization_id: organizationId,
        },
      });

      const ack = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/ack",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {
          requestId: briefBody.requestId,
          snapshotHash: briefBody.snapshotHash,
          projects: briefBody.brief.projects.map((p) => ({
            projectId: p.projectId,
            acknowledgedThrough: p.generatedThrough,
          })),
        },
      });

      expect(ack.statusCode).toBe(403);
      const ackBody = JSON.parse(ack.body) as { ok: boolean; error?: string };
      expect(ackBody.ok).toBe(false);
      expect(ackBody.error).toBe("forbidden");

      await prisma.organizationMembership.create({
        data: {
          user_id: user.id,
          organization_id: organizationId,
          role: OrgRole.VIEWER,
        },
      });
    });

    it("returns 403 when the organization is soft-deleted", async () => {
      const brief = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/workspace",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {},
      });
      const briefBody = JSON.parse(brief.body) as {
        status: string;
        requestId: string;
        snapshotHash: string;
        brief: { projects: Array<{ projectId: string; generatedThrough: string }> };
      };
      expect(briefBody.status).toBe("ok");

      await prisma.organization.update({
        where: { id: organizationId },
        data: { deleted_at: new Date() },
      });

      const ack = await app!.inject({
        method: "POST",
        url: "/api/meta/brief/ack",
        headers: {
          authorization: `Bearer ${sessionId}`,
          "x-organization-id": organizationId,
          "content-type": "application/json",
        },
        payload: {
          requestId: briefBody.requestId,
          snapshotHash: briefBody.snapshotHash,
          projects: briefBody.brief.projects.map((p) => ({
            projectId: p.projectId,
            acknowledgedThrough: p.generatedThrough,
          })),
        },
      });

      expect(ack.statusCode).toBe(403);

      await prisma.organization.update({
        where: { id: organizationId },
        data: { deleted_at: null },
      });
    });
  }
);
