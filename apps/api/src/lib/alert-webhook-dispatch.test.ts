import { describe, expect, it, vi } from "vitest";
import {
  buildAlertWebhookPayload,
  enqueueAlertWebhookDeliveries,
  isBlockedIpAddress,
  isBlockedWebhookHostname,
  listAlertWebhookDeliveries,
  postWebhookOnce,
  resolveWebhookHostForDelivery,
  sendTestWebhook,
  signWebhookBody,
  validateWebhookUrl,
  WEBHOOK_MAX_ATTEMPTS,
  type WebhookDnsLookup,
} from "./alert-webhook-dispatch.js";
import {
  claimNextAlertWebhookDelivery,
  completeAlertWebhookDelivery,
  failAlertWebhookDeliveryAttempt,
} from "./alert-webhook-delivery-job.js";
import { processNextAlertWebhookDelivery } from "./alert-webhook-worker.js";

const publicLookup: WebhookDnsLookup = async () => [{ address: "203.0.113.10", family: 4 }];

describe("webhook URL validation", () => {
  it("keeps create-time HTTPS and hostname protections", () => {
    expect(validateWebhookUrl("https://hooks.example.com/path")).toMatchObject({ ok: true });
    expect(validateWebhookUrl("http://hooks.example.com")).toMatchObject({ ok: false });
    expect(validateWebhookUrl("https://localhost/hook")).toMatchObject({ ok: false });
    expect(isBlockedWebhookHostname("127.0.0.1")).toBe(true);
  });

  it("blocks private, loopback, link-local, and ULA addresses", () => {
    for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1", "::1", "fe80::1", "fd00::1"]) {
      expect(isBlockedIpAddress(ip), ip).toBe(true);
    }
    expect(isBlockedIpAddress("203.0.113.10")).toBe(false);
  });
});

describe("delivery-time DNS protections", () => {
  it("rejects hostnames that resolve to blocked IPv4 addresses", async () => {
    for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "192.168.1.1"]) {
      const lookupFn: WebhookDnsLookup = async () => [{ address, family: 4 }];
      await expect(
        resolveWebhookHostForDelivery("evil.example", lookupFn),
        address
      ).resolves.toMatchObject({ ok: false });
    }
  });

  it("rejects hostnames that resolve to blocked IPv6 ranges", async () => {
    for (const address of ["::1", "fe80::1", "fd00::1"]) {
      const lookupFn: WebhookDnsLookup = async () => [{ address, family: 6 }];
      await expect(
        resolveWebhookHostForDelivery("evil6.example", lookupFn),
        address
      ).resolves.toMatchObject({ ok: false });
    }
  });

  it("passes the injected resolver to the pinned transport", async () => {
    const lookupFn: WebhookDnsLookup = async () => [{ address: "127.0.0.1", family: 4 }];
    await expect(
      postWebhookOnce("https://blocked.example/hook", "{}", null, "d1", { lookupFn })
    ).resolves.toEqual({
      ok: false,
      httpStatus: null,
      error: "Webhook URL host is not allowed",
    });
  });

  it("allows public DNS answers", async () => {
    await expect(resolveWebhookHostForDelivery("hooks.example.com", publicLookup)).resolves.toMatchObject({
      ok: true,
      addresses: [{ address: "203.0.113.10", family: 4 }],
    });
  });
});

describe("enqueueAlertWebhookDeliveries", () => {
  it("persists PENDING rows for each enabled webhook", async () => {
    const createMany = vi.fn(async () => ({ count: 1 }));
    const prisma = {
      projectWebhook: { findMany: async () => [{ id: "wh1" }] },
      alertWebhookDelivery: { createMany },
    };
    const count = await enqueueAlertWebhookDeliveries(prisma as never, {
      projectId: "p1",
      alertEventId: "ae1",
      dedupeKey: "k1",
    });
    expect(count).toBe(1);
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            webhook_id: "wh1",
            status: "PENDING",
            attempt: 0,
            alert_event_id: "ae1",
          }),
        ],
      })
    );
  });
});

describe("claim / retry / DEAD", () => {
  it("claims with lease and increments attempt", async () => {
    const update = vi.fn(async () => ({
      id: "d1",
      webhook_id: "wh1",
      project_id: "p1",
      alert_event_id: "ae1",
      dedupe_key: "k1",
      attempt: 1,
      status: "PROCESSING",
      http_status: null,
      error: null,
      lease_owner: "w1",
      lease_expires_at: new Date("2026-07-17T12:00:30.000Z"),
      next_attempt_at: new Date("2026-07-17T12:00:00.000Z"),
      created_at: new Date("2026-07-17T12:00:00.000Z"),
      updated_at: new Date("2026-07-17T12:00:00.000Z"),
    }));
    const prisma = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: async () => [
            {
              id: "d1",
              webhook_id: "wh1",
              project_id: "p1",
              alert_event_id: "ae1",
              dedupe_key: "k1",
              attempt: 0,
              status: "PENDING",
              http_status: null,
              error: null,
              lease_owner: null,
              lease_expires_at: null,
              next_attempt_at: new Date("2026-07-17T12:00:00.000Z"),
              created_at: new Date("2026-07-17T12:00:00.000Z"),
              updated_at: new Date("2026-07-17T12:00:00.000Z"),
            },
          ],
          alertWebhookDelivery: { update },
        }),
    };
    const row = await claimNextAlertWebhookDelivery(prisma as never, {
      workerId: "w1",
      now: new Date("2026-07-17T12:00:00.000Z"),
    });
    expect(row?.attempt).toBe(1);
    expect(row?.status).toBe("PROCESSING");
  });

  it("schedules FAILED then DEAD", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = { alertWebhookDelivery: { updateMany } };
    expect(
      await failAlertWebhookDeliveryAttempt(prisma as never, {
        deliveryId: "d1",
        workerId: "w1",
        attempt: 1,
        httpStatus: 500,
        error: "HTTP 500",
        now: new Date(),
      })
    ).toBe("FAILED");
    expect(
      await failAlertWebhookDeliveryAttempt(prisma as never, {
        deliveryId: "d1",
        workerId: "w1",
        attempt: WEBHOOK_MAX_ATTEMPTS,
        httpStatus: 500,
        error: "HTTP 500",
        now: new Date(),
      })
    ).toBe("DEAD");
  });

  it("completes SUCCESS", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    expect(
      await completeAlertWebhookDelivery(
        { alertWebhookDelivery: { updateMany } } as never,
        { deliveryId: "d1", workerId: "w1", httpStatus: 200 }
      )
    ).toBe(true);
  });
});

describe("processNextAlertWebhookDelivery", () => {
  it("posts signed payload and marks SUCCESS", async () => {
    const sendImpl = vi.fn(async () => ({ ok: true as const, httpStatus: 200 }));
    const completeUpdate = vi.fn(async () => ({ count: 1 }));
    const prisma = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: async () => [
            {
              id: "d1",
              webhook_id: "wh1",
              project_id: "p1",
              alert_event_id: "ae1",
              dedupe_key: "k1",
              attempt: 0,
              status: "PENDING",
              http_status: null,
              error: null,
              lease_owner: null,
              lease_expires_at: null,
              next_attempt_at: new Date("2026-07-17T12:00:00.000Z"),
              created_at: new Date("2026-07-17T12:00:00.000Z"),
              updated_at: new Date("2026-07-17T12:00:00.000Z"),
            },
          ],
          alertWebhookDelivery: {
            update: async () => ({
              id: "d1",
              webhook_id: "wh1",
              project_id: "p1",
              alert_event_id: "ae1",
              dedupe_key: "k1",
              attempt: 1,
              status: "PROCESSING",
              http_status: null,
              error: null,
              lease_owner: "worker-1",
              lease_expires_at: new Date("2026-07-17T12:01:00.000Z"),
              next_attempt_at: new Date("2026-07-17T12:00:00.000Z"),
              created_at: new Date("2026-07-17T12:00:00.000Z"),
              updated_at: new Date("2026-07-17T12:00:00.000Z"),
            }),
          },
        }),
      projectWebhook: {
        findFirst: async () => ({
          id: "wh1",
          url: "https://hooks.example.com/a",
          signing_secret: "sekrit",
          enabled: true,
        }),
      },
      alertEvent: {
        findUnique: async () => ({
          rule: "ERROR_SPIKE",
          title: "Spike",
          body: "n",
          href: null,
          fired_at: new Date("2026-07-17T10:00:00.000Z"),
        }),
      },
      alertWebhookDelivery: { updateMany: completeUpdate },
    };
    const result = await processNextAlertWebhookDelivery({
      prisma: prisma as never,
      workerId: "worker-1",
      now: () => new Date("2026-07-17T12:00:00.000Z"),
      sendImpl,
    });
    expect(result).toEqual({ status: "success", deliveryId: "d1" });
    const sent = sendImpl.mock.calls[0]?.[0];
    expect(JSON.parse(sent.body).event).toBe("alert.fired");
    expect(sent.signature).toBe(signWebhookBody(sent.body, "sekrit"));
  });
});

describe("sendTestWebhook", () => {
  it("logs single-shot failures as FAILED not DEAD", async () => {
    const create = vi.fn(async () => ({ id: "log" }));
    const result = await sendTestWebhook(
      {
        projectWebhook: {
          findFirst: async () => ({
            id: "wh1",
            url: "https://hooks.example.com/a",
            signing_secret: null,
          }),
        },
        alertWebhookDelivery: { create },
      } as never,
      "p1",
      "wh1",
      {
        sendImpl: async () => ({ ok: false, httpStatus: 500, error: "HTTP 500" }),
      }
    );
    expect(result.ok).toBe(false);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      data: { status: "FAILED" },
    });
  });
});

describe("buildAlertWebhookPayload", () => {
  it("builds versioned alert.fired payloads", () => {
    expect(
      buildAlertWebhookPayload({
        deliveryId: "d1",
        projectId: "p1",
        rule: "ERROR_SPIKE",
        title: "Spike",
        body: "Many errors",
        href: "/dashboard/errors",
        dedupeKey: "alert:error_spike:p1:1",
        firedAt: new Date("2026-07-17T10:00:00.000Z"),
      })
    ).toMatchObject({ version: 1, event: "alert.fired", deliveryId: "d1" });
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
    ]);
    const rows = await listAlertWebhookDeliveries(
      { alertWebhookDelivery: { findMany } } as never,
      "p1",
      { limit: 10 }
    );
    expect(rows[0]).toMatchObject({
      id: "d1",
      webhookUrlMasked: "https://hooks.example.com/***",
      status: "SUCCESS",
    });
  });
});
