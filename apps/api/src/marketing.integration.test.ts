import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { MarketingSubscriberSource } from "@prisma/client";
import { createApp } from "./app.js";
import { prisma } from "./lib/db.js";
import { hashMarketingUnsubscribeToken } from "./lib/marketing-subscriber.js";

const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";

describe.skipIf(!runDbIntegration)("Marketing API (integration)", () => {
  let app: FastifyInstance | undefined;
  const suffix = randomBytes(6).toString("hex");
  const subscribeEmail = `subscribe-${suffix}@test.local`;
  const registerEmail = `register-${suffix}@test.local`;
  let unsubscribeToken = "";

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    if (app) await app.close();
    await prisma.marketingSubscriber.deleteMany({
      where: { email: { in: [subscribeEmail, registerEmail] } },
    }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: registerEmail } }).catch(() => undefined);
  });

  it("POST /api/marketing/subscribe validates email", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/marketing/subscribe",
      headers: { "content-type": "application/json" },
      payload: { email: "not-valid" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/marketing/subscribe creates subscriber", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/marketing/subscribe",
      headers: { "content-type": "application/json" },
      payload: { email: subscribeEmail },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { ok: boolean; created: boolean };
    expect(body.ok).toBe(true);
    expect(body.created).toBe(true);

    const row = await prisma.marketingSubscriber.findUnique({ where: { email: subscribeEmail } });
    expect(row?.source).toBe(MarketingSubscriberSource.subscribe_form);
    unsubscribeToken = randomBytes(32).toString("hex");
    await prisma.marketingSubscriber.update({
      where: { email: subscribeEmail },
      data: { unsubscribe_token: hashMarketingUnsubscribeToken(unsubscribeToken) },
    });
  });

  it("POST /api/marketing/unsubscribe rejects missing token", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/marketing/unsubscribe",
      headers: { "content-type": "application/json" },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/marketing/unsubscribe unsubscribes by token", async () => {
    const res = await app!.inject({
      method: "POST",
      url: "/api/marketing/unsubscribe",
      headers: { "content-type": "application/json" },
      payload: { token: unsubscribeToken },
    });
    expect(res.statusCode).toBe(200);
    const row = await prisma.marketingSubscriber.findUnique({ where: { email: subscribeEmail } });
    expect(row?.unsubscribed_at).not.toBeNull();
  });

  it("POST /api/auth/register adds subscriber when marketingOptIn is true", async () => {
    const prevAllow = process.env.TELEMETRY_ALLOW_REGISTRATION;
    process.env.TELEMETRY_ALLOW_REGISTRATION = "true";
    try {
      const res = await app!.inject({
        method: "POST",
        url: "/api/auth/register",
        headers: { "content-type": "application/json" },
        payload: {
          email: registerEmail,
          password: "testpass12",
          displayName: "Marketing Test",
          marketingOptIn: true,
        },
      });
      expect(res.statusCode).toBe(201);

      const row = await prisma.marketingSubscriber.findUnique({ where: { email: registerEmail } });
      expect(row?.source).toBe(MarketingSubscriberSource.registration);
      expect(row?.unsubscribed_at).toBeNull();
    } finally {
      if (prevAllow === undefined) delete process.env.TELEMETRY_ALLOW_REGISTRATION;
      else process.env.TELEMETRY_ALLOW_REGISTRATION = prevAllow;
    }
  });

  it("POST /api/auth/register skips subscriber when marketingOptIn is false", async () => {
    const optOutEmail = `optout-${suffix}@test.local`;
    const prevAllow = process.env.TELEMETRY_ALLOW_REGISTRATION;
    process.env.TELEMETRY_ALLOW_REGISTRATION = "true";
    try {
      const res = await app!.inject({
        method: "POST",
        url: "/api/auth/register",
        headers: { "content-type": "application/json" },
        payload: {
          email: optOutEmail,
          password: "testpass12",
          marketingOptIn: false,
        },
      });
      expect(res.statusCode).toBe(201);
      const row = await prisma.marketingSubscriber.findUnique({ where: { email: optOutEmail } });
      expect(row).toBeNull();
    } finally {
      await prisma.user.deleteMany({ where: { email: optOutEmail } }).catch(() => undefined);
      if (prevAllow === undefined) delete process.env.TELEMETRY_ALLOW_REGISTRATION;
      else process.env.TELEMETRY_ALLOW_REGISTRATION = prevAllow;
    }
  });
});
