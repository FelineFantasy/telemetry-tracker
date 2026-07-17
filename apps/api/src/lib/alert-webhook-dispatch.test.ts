import { describe, expect, it, vi } from "vitest";
import {
  buildAlertWebhookPayload,
  dispatchAlertWebhooks,
  isBlockedIpAddress,
  isBlockedWebhookHostname,
  postWebhookOnce,
  resolveWebhookHostForDelivery,
  sendTestWebhook,
  signWebhookBody,
  validateWebhookUrl,
  WEBHOOK_MAX_ATTEMPTS,
  type WebhookDnsLookup,
  type WebhookSendImpl,
} from "./alert-webhook-dispatch.js";

const publicLookup: WebhookDnsLookup = async () => [{ address: "203.0.113.10", family: 4 }];

describe("webhook URL validation", () => {
  it("keeps create-time HTTPS and hostname protections", () => {
    expect(validateWebhookUrl("https://hooks.example.com/path")).toMatchObject({ ok: true });
    expect(validateWebhookUrl("http://hooks.example.com")).toMatchObject({ ok: false });
    expect(validateWebhookUrl("https://localhost/hook")).toMatchObject({ ok: false });
    expect(isBlockedWebhookHostname("127.0.0.1")).toBe(true);
  });

  it("blocks private, loopback, link-local, and ULA addresses", () => {
    for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "fe80::1", "fd00::1"]) {
      expect(isBlockedIpAddress(ip)).toBe(true);
    }
    expect(isBlockedIpAddress("203.0.113.10")).toBe(false);
  });
});

describe("delivery-time DNS protections", () => {
  it("rejects hostnames that resolve to private addresses", async () => {
    const lookupFn: WebhookDnsLookup = async () => [{ address: "169.254.169.254", family: 4 }];
    await expect(resolveWebhookHostForDelivery("metadata.example", lookupFn)).resolves.toMatchObject({ ok: false });
  });

  it("passes the injected resolver to the pinned transport", async () => {
    const lookupFn: WebhookDnsLookup = async () => [{ address: "127.0.0.1", family: 4 }];
    await expect(postWebhookOnce("https://blocked.example/hook", "{}", null, "d1", { lookupFn })).resolves.toEqual({
      ok: false, httpStatus: null, error: "Webhook URL host is not allowed",
    });
  });

  it("allows public DNS answers", async () => {
    await expect(resolveWebhookHostForDelivery("hooks.example.com", publicLookup)).resolves.toMatchObject({
      ok: true, addresses: [{ address: "203.0.113.10", family: 4 }],
    });
  });
});

describe("dispatchAlertWebhooks", () => {
  const input = {
    projectId: "p1", alertEventId: "ae1", rule: "ERROR_SPIKE" as const,
    title: "Spike", body: "Many errors", href: "/dashboard/errors",
    dedupeKey: "alert:error-spike:p1", firedAt: new Date("2026-07-17T10:00:00.000Z"),
  };

  it("uses injected sendImpl, signs payloads, and logs FAILED then DEAD", async () => {
    const create = vi.fn(async () => ({ id: "log" }));
    const sendImpl: WebhookSendImpl = vi.fn(async () => ({ ok: false as const, httpStatus: 500, error: "HTTP 500" }));
    const prisma = {
      projectWebhook: { findMany: async () => [{ id: "wh1", url: "https://hooks.example.com/a", signing_secret: "secret" }] },
      alertWebhookDelivery: { create },
    };

    await dispatchAlertWebhooks(prisma as never, input, { sendImpl, lookupFn: publicLookup });

    expect(sendImpl).toHaveBeenCalledTimes(WEBHOOK_MAX_ATTEMPTS);
    expect(sendImpl).toHaveBeenCalledWith(expect.objectContaining({ lookupFn: publicLookup }));
    const sent = vi.mocked(sendImpl).mock.calls[0]?.[0];
    expect(JSON.parse(sent!.body)).toMatchObject({ event: "alert.fired", projectId: "p1" });
    expect(sent!.signature).toBe(signWebhookBody(sent!.body, "secret"));
    expect(create.mock.calls.map((call) => call[0].data.status)).toEqual(["FAILED", "DEAD"]);
  });

  it("logs SUCCESS without retrying", async () => {
    const create = vi.fn(async () => ({ id: "log" }));
    const sendImpl: WebhookSendImpl = vi.fn(async () => ({ ok: true as const, httpStatus: 204 }));
    const prisma = {
      projectWebhook: { findMany: async () => [{ id: "wh1", url: "https://hooks.example.com/a", signing_secret: null }] },
      alertWebhookDelivery: { create },
    };
    await dispatchAlertWebhooks(prisma as never, input, { sendImpl });
    expect(sendImpl).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SUCCESS", attempt: 1, http_status: 204 }),
    }));
  });
});

describe("sendTestWebhook", () => {
  it("logs FAILED rather than DEAD for a single-shot failure", async () => {
    const create = vi.fn(async () => ({ id: "log" }));
    const prisma = {
      projectWebhook: { findFirst: async () => ({ id: "wh1", url: "https://hooks.example.com/a", signing_secret: null }) },
      alertWebhookDelivery: { create },
    };
    const sendImpl: WebhookSendImpl = vi.fn(async () => ({ ok: false as const, httpStatus: 500, error: "HTTP 500" }));
    const result = await sendTestWebhook(prisma as never, "p1", "wh1", { sendImpl, lookupFn: publicLookup });
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(sendImpl).toHaveBeenCalledWith(expect.objectContaining({ lookupFn: publicLookup }));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "FAILED", attempt: 1 }),
    }));
  });
});

describe("payloads", () => {
  it("builds a versioned alert payload", () => {
    expect(buildAlertWebhookPayload({
      deliveryId: "d1", projectId: "p1", rule: "ERROR_SPIKE", title: "Spike", body: "Many errors",
      href: null, dedupeKey: "k1", firedAt: new Date("2026-07-17T10:00:00.000Z"),
    })).toMatchObject({ version: 1, event: "alert.fired", deliveryId: "d1" });
  });
});
