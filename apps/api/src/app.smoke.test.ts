import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "./app.js";

describe("API smoke", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health returns 200", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it("POST /ingest/event without API key returns 401", async () => {
    const prev = process.env.INGEST_ALLOW_UNAUTHENTICATED;
    delete process.env.INGEST_ALLOW_UNAUTHENTICATED;
    try {
      const res = await app.inject({
        method: "POST",
        url: "/ingest/event",
        payload: {
          app: "test-app",
          name: "test-event",
        },
        headers: { "content-type": "application/json" },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body) as { error?: string };
      expect(body.error).toBeDefined();
    } finally {
      if (prev !== undefined) {
        process.env.INGEST_ALLOW_UNAUTHENTICATED = prev;
      }
    }
  });

  it("GET /api/meta/projects returns 401 without session in production", async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevAllowReads = process.env.TELEMETRY_ALLOW_UNAUTHENTICATED_READS;
    process.env.NODE_ENV = "production";
    delete process.env.TELEMETRY_ALLOW_UNAUTHENTICATED_READS;

    try {
      const res = await app.inject({
        method: "GET",
        url: "/api/meta/projects",
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body) as { error?: string };
      expect(body.error).toBe("Unauthorized");
    } finally {
      if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNodeEnv;
      if (prevAllowReads === undefined) delete process.env.TELEMETRY_ALLOW_UNAUTHENTICATED_READS;
      else process.env.TELEMETRY_ALLOW_UNAUTHENTICATED_READS = prevAllowReads;
    }
  });
});
