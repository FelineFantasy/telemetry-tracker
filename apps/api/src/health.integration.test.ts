import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "./app.js";

const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";

describe.skipIf(!runDbIntegration)("GET /health with database check (integration)", () => {
  let app: FastifyInstance | undefined;
  let prevHealth: string | undefined;

  beforeAll(async () => {
    prevHealth = process.env.HEALTH_CHECK_DATABASE;
    process.env.HEALTH_CHECK_DATABASE = "true";
    app = await createApp();
  });

  afterAll(async () => {
    if (prevHealth === undefined) delete process.env.HEALTH_CHECK_DATABASE;
    else process.env.HEALTH_CHECK_DATABASE = prevHealth;
    if (app) await app.close();
  });

  it("returns 200 and database ok when HEALTH_CHECK_DATABASE=true", async () => {
    const res = await app!.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true, database: "ok" });
  });
});
