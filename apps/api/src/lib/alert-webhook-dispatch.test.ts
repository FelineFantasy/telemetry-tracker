import { describe, expect, it, vi } from "vitest";
import {
  assertWebhookResolvedHostAllowed,
  buildAlertWebhookPayload,
  dispatchAlertWebhooks,
  isBlockedIpAddress,
  listAlertWebhookDeliveries,
  maskWebhookUrl,
  sendTestWebhook,
  signWebhookBody,
  validateWebhookUrl,
  WEBHOOK_MAX_ATTEMPTS,
} from "./alert-webhook-dispatch.js";

const allowHost = async () => ({ ok: true as const });

describe("validateWebhookUrl", () => {
  it("requires https and rejects private / loopback hosts", () => {
    expect(validateWebhookUrl("http://example.com/hook").ok).toBe(false);
    expect(validateWebhookUrl("https://localhost/hook").ok).toBe(false);
    expect(validateWebhookUrl("https://127.0.0.1/hook").ok).toBe(false);
    expect(validateWebhookUrl("https://127.1/hook").ok).toBe(false);
    expect(validateWebhookUrl("https://10.0.0.5/hook").ok).toBe(false);
    expect(validateWebhookUrl("https://192.168.1.1/hook").ok).toBe(false);
    expect(validateWebhookUrl("https://hooks.example.com/a/b").ok).toBe(true);
  });
});

describe("isBlockedIpAddress", () => {
  it("blocks private, loopback, link-local, and CGNAT IPv4", () => {
    expect(isBlockedIpAddress("127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("10.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("192.168.1.1")).toBe(true);
    expect(isBlockedIpAddress("169.254.169.254")).toBe(true);
    expect(isBlockedIpAddress("172.16.0.1")).toBe(true);
    expect(isBlockedIpAddress("100.64.0.1")).toBe(true);
    expect(isBlockedIpAddress("8.8.8.8")).toBe(false);
  });

  it("blocks loopback / ULA / link-local IPv6 and mapped private IPv4", () => {
    expect(isBlockedIpAddress("::1")).toBe(true);
    expect(isBlockedIpAddress("fc00::1")).toBe(true);
    expect(isBlockedIpAddress("fe80::1")).toBe(true);
    expect(isBlockedIpAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIpAddress("2001:4860:4860::8888")).toBe(false);
  });
});

describe("assertWebhookResolvedHostAllowed", () => {
  it("rejects literal private hosts without DNS", async () => {
    await expect(assertWebhookResolvedHostAllowed("127.0.0.1")).resolves.toMatchObject({
      ok: false,
    });
    await expect(assertWebhookResolvedHostAllowed("localhost")).resolves.toMatchObject({
      ok: false,
    });
  });
});

describe("maskWebhookUrl", () => {
  it("hides path details", () => {
    expect(maskWebhookUrl("https://hooks.example.com/secret/path")).toBe(
      "https://hooks.example.com/***"
    );
  });
});

describe("signWebhookBody", () => {
  it("produces a stable sha256 HMAC header value", () => {
    const sig = signWebhookBody('{"a":1}', "secret");
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(signWebhookBody('{"a":1}', "secret")).toBe(sig);
    expect(signWebhookBody('{"a":2}', "secret")).not.toBe(sig);
  });
});

describe("buildAlertWebhookPayload", () => {
  it("builds versioned alert.fired payloads", () => {
    const payload = buildAlertWebhookPayload({
      deliveryId: "d1",
      projectId: "p1",
      rule: "ERROR_SPIKE",
      title: "Spike",
      body: "Many errors",
      href: "/dashboard/errors",
      dedupeKey: "alert:error_spike:p1:1",
      firedAt: new Date("2026-07-17T10:00:00.000Z"),
    });
    expect(payload).toMatchObject({
      version: 1,
      event: "alert.fired",
      deliveryId: "d1",
      projectId: "p1",
      rule: "ERROR_SPIKE",
      dedupeKey: "alert:error_spike:p1:1",
      firedAt: "2026-07-17T10:00:00.000Z",
    });
  });
});

describe("dispatchAlertWebhooks", () => {
  it("posts to enabled webhooks, signs, retries, then dead-letters", async () => {
    const create = vi.fn(async () => ({ id: "log" }));
    const prisma = {
      projectWebhook: {
        findMany: async () => [
          {
            id: "wh1",
            url: "https://hooks.example.com/a",
            signing_secret: "sekrit",
          },
        ],
      },
      alertWebhookDelivery: { create },
    };

    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return {
        ok: false,
        status: 500,
      } as Response;
    });

    await dispatchAlertWebhooks(
      prisma as never,
      {
        projectId: "p1",
        alertEventId: "ae1",
        rule: "QUOTA_NEAR",
        title: "Near",
        body: "90%",
        href: "/dashboard/settings/billing",
        dedupeKey: "quota:near:p1:2026-07",
      },
      { fetchImpl: fetchImpl as never, resolveHost: allowHost }
    );

    expect(calls).toBe(WEBHOOK_MAX_ATTEMPTS);
    expect(fetchImpl).toHaveBeenCalledTimes(WEBHOOK_MAX_ATTEMPTS);
    const firstBody = (fetchImpl.mock.calls[0]?.[1] as { body: string }).body;
    const firstHeaders = (fetchImpl.mock.calls[0]?.[1] as { headers: Record<string, string> })
      .headers;
    const firstInit = fetchImpl.mock.calls[0]?.[1] as { redirect?: string };
    expect(firstInit.redirect).toBe("manual");
    expect(JSON.parse(firstBody).event).toBe("alert.fired");
    expect(firstHeaders["X-Telemetry-Signature"]).toBe(
      signWebhookBody(firstBody, "sekrit")
    );
    expect(create).toHaveBeenCalledTimes(WEBHOOK_MAX_ATTEMPTS);
    expect(create.mock.calls.at(-1)?.[0]).toMatchObject({
      data: { status: "DEAD", attempt: WEBHOOK_MAX_ATTEMPTS },
    });
  });

  it("treats HTTP redirects as delivery failures", async () => {
    const create = vi.fn(async () => ({ id: "log" }));
    const prisma = {
      projectWebhook: {
        findMany: async () => [
          { id: "wh1", url: "https://hooks.example.com/a", signing_secret: null },
        ],
      },
      alertWebhookDelivery: { create },
    };
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 302 }) as Response);

    await dispatchAlertWebhooks(
      prisma as never,
      {
        projectId: "p1",
        alertEventId: "ae1",
        rule: "ERROR_SPIKE",
        title: "Spike",
        body: "n",
        href: null,
        dedupeKey: "k-redirect",
      },
      { fetchImpl: fetchImpl as never, resolveHost: allowHost }
    );

    expect(create.mock.calls.at(-1)?.[0]).toMatchObject({
      data: {
        status: "DEAD",
        error: "HTTP 302 (redirect not followed)",
      },
    });
  });

  it("skips fetch when resolved host is blocked (DNS rebinding guard)", async () => {
    const create = vi.fn(async () => ({ id: "log" }));
    const prisma = {
      projectWebhook: {
        findMany: async () => [
          { id: "wh1", url: "https://127.0.0.1.nip.io/hook", signing_secret: null },
        ],
      },
      alertWebhookDelivery: { create },
    };
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    const resolveHost = vi.fn(async () => ({
      ok: false as const,
      error: "Webhook URL host is not allowed",
    }));

    await dispatchAlertWebhooks(
      prisma as never,
      {
        projectId: "p1",
        alertEventId: "ae1",
        rule: "ERROR_SPIKE",
        title: "Spike",
        body: "n",
        href: null,
        dedupeKey: "k-ssrf",
      },
      { fetchImpl: fetchImpl as never, resolveHost }
    );

    expect(resolveHost).toHaveBeenCalledWith("127.0.0.1.nip.io");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(create.mock.calls.at(-1)?.[0]).toMatchObject({
      data: {
        status: "DEAD",
        error: "Webhook URL host is not allowed",
      },
    });
  });

  it("records SUCCESS on the first successful attempt", async () => {
    const create = vi.fn(async () => ({ id: "log" }));
    const prisma = {
      projectWebhook: {
        findMany: async () => [
          { id: "wh1", url: "https://hooks.example.com/a", signing_secret: null },
        ],
      },
      alertWebhookDelivery: { create },
    };
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 204 }) as Response);

    await dispatchAlertWebhooks(
      prisma as never,
      {
        projectId: "p1",
        alertEventId: "ae1",
        rule: "ERROR_SPIKE",
        title: "Spike",
        body: "n",
        href: null,
        dedupeKey: "k1",
      },
      { fetchImpl: fetchImpl as never, resolveHost: allowHost }
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS", attempt: 1 }),
      })
    );
  });
});

describe("sendTestWebhook", () => {
  it("records FAILED (not DEAD) for a single-shot test error", async () => {
    const create = vi.fn(async () => ({ id: "log" }));
    const prisma = {
      projectWebhook: {
        findFirst: async () => ({
          id: "wh1",
          url: "https://hooks.example.com/a",
          signing_secret: null,
        }),
      },
      alertWebhookDelivery: { create },
    };
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 }) as Response);

    const result = await sendTestWebhook(prisma as never, "p1", "wh1", {
      fetchImpl: fetchImpl as never,
      resolveHost: allowHost,
    });

    expect(result.ok).toBe(false);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", attempt: 1 }),
      })
    );
  });
});

describe("listAlertWebhookDeliveries", () => {
  it("returns newest-first public rows with masked URLs", async () => {
    const findMany = vi.fn(async () => [
      {
        id: "d1",
        webhook_id: "wh1",
        status: "SUCCESS" as const,
        attempt: 1,
        http_status: 200,
        error: null,
        created_at: new Date("2026-07-17T12:00:00.000Z"),
        webhook: { label: "Ops", url: "https://hooks.example.com/secret" },
      },
      {
        id: "d2",
        webhook_id: "wh2",
        status: "DEAD" as const,
        attempt: 2,
        http_status: 500,
        error: "HTTP 500",
        created_at: new Date("2026-07-17T11:00:00.000Z"),
        webhook: { label: null, url: "https://hooks.example.com/other" },
      },
    ]);
    const prisma = {
      alertWebhookDelivery: { findMany },
    };

    const rows = await listAlertWebhookDeliveries(prisma as never, "p1", {
      limit: 10,
      webhookId: "wh1",
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { project_id: "p1", webhook_id: "wh1" },
        take: 10,
        orderBy: { created_at: "desc" },
      })
    );
    expect(rows).toEqual([
      {
        id: "d1",
        webhookId: "wh1",
        webhookLabel: "Ops",
        webhookUrlMasked: "https://hooks.example.com/***",
        status: "SUCCESS",
        attempt: 1,
        httpStatus: 200,
        error: null,
        createdAt: "2026-07-17T12:00:00.000Z",
      },
      {
        id: "d2",
        webhookId: "wh2",
        webhookLabel: null,
        webhookUrlMasked: "https://hooks.example.com/***",
        status: "DEAD",
        attempt: 2,
        httpStatus: 500,
        error: "HTTP 500",
        createdAt: "2026-07-17T11:00:00.000Z",
      },
    ]);
  });

  it("clamps limit and omits webhook filter when unset", async () => {
    const findMany = vi.fn(async () => []);
    await listAlertWebhookDeliveries(
      { alertWebhookDelivery: { findMany } } as never,
      "p1",
      { limit: 999 }
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { project_id: "p1" },
        take: 50,
      })
    );
  });
});
