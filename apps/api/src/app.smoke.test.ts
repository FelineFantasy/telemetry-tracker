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
    expect(JSON.parse(res.body)).toEqual({ ok: true });
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
});
