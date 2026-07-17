import { describe, expect, it, vi } from "vitest";
import {
  buildAlertWebhookPayload,
  createProjectWebhook,
  enqueueAlertWebhookDeliveries,
  isBlockedIpAddress,
  isBlockedWebhookHostname,
  listAlertWebhookDeliveries,
  MAX_PROJECT_WEBHOOKS,
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

  it("blocks IPv4-mapped and IPv4-compatible embeddings in any encoding", () => {
    for (const ip of [
      "::ffff:127.0.0.1",
      "0:0:0:0:0:ffff:127.0.0.1",
      "::ffff:7f00:1",
      "0:0:0:0:0:ffff:7f00:1",
      "::127.0.0.1",
      "0:0:0:0:0:0:127.0.0.1",
      "0:0:0:0:0:0:0:1",
      "::ffff:10.0.0.1",
      "::ffff:a00:1",
      "::ffff:169.254.169.254",
      "::ffff:a9fe:a9fe",
    ]) {
      expect(isBlockedIpAddress(ip), ip).toBe(true);
    }
    for (const ip of ["::ffff:8.8.8.8", "::ffff:808:808", "2001:db8::1"]) {
      expect(isBlockedIpAddress(ip), ip).toBe(false);
    }
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
    for (const address of [
      "::1",
      "fe80::1",
      "fd00::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "0:0:0:0:0:ffff:127.0.0.1",
      "::127.0.0.1",
    ]) {
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
    const updateMany = vi
      .fn()
      // renew lease
      .mockResolvedValueOnce({ count: 1 })
      // complete SUCCESS
      .mockResolvedValueOnce({ count: 1 });
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
      alertWebhookDelivery: { updateMany },
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
    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  it("does not report success when completion loses the lease", async () => {
    const sendImpl = vi.fn(async () => ({ ok: true as const, httpStatus: 200 }));
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 1 }) // renew
      .mockResolvedValueOnce({ count: 0 }); // complete missed
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
          signing_secret: null,
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
      alertWebhookDelivery: { updateMany },
    };
    const result = await processNextAlertWebhookDelivery({
      prisma: prisma as never,
      workerId: "worker-1",
      now: () => new Date("2026-07-17T12:00:00.000Z"),
      sendImpl,
    });
    expect(result).toEqual({
      status: "failed",
      deliveryId: "d1",
      terminal: "FAILED",
      error: "Lease lost after successful delivery",
    });
    expect(sendImpl).toHaveBeenCalledOnce();
  });

  it("skips POST when the lease cannot be renewed", async () => {
    const sendImpl = vi.fn(async () => ({ ok: true as const, httpStatus: 200 }));
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
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
          signing_secret: null,
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
      alertWebhookDelivery: { updateMany },
    };
    const result = await processNextAlertWebhookDelivery({
      prisma: prisma as never,
      workerId: "worker-1",
      now: () => new Date("2026-07-17T12:00:00.000Z"),
      sendImpl,
    });
    expect(result).toEqual({
      status: "failed",
      deliveryId: "d1",
      terminal: "FAILED",
      error: "Lease lost before delivery",
    });
    expect(sendImpl).not.toHaveBeenCalled();
  });
});

describe("createProjectWebhook", () => {
  it("enforces the per-project cap inside a serializable transaction", async () => {
    const create = vi.fn();
    const count = vi.fn(async () => 5);
    const prisma = {
      $transaction: async (
        fn: (tx: unknown) => Promise<unknown>,
        opts?: { isolationLevel?: string }
      ) => {
        expect(opts?.isolationLevel).toBeTruthy();
        return fn({
          projectWebhook: { count, create },
        });
      },
    };
    const result = await createProjectWebhook(prisma as never, "p1", {
      url: "https://hooks.example.com/a",
    });
    expect(result).toEqual({
      ok: false,
      error: `At most ${MAX_PROJECT_WEBHOOKS} webhooks per project`,
      status: 409,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("creates when under the cap", async () => {
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: args.data.id,
      url: args.data.url,
      label: null,
      enabled: true,
      created_at: new Date("2026-07-17T12:00:00.000Z"),
      updated_at: new Date("2026-07-17T12:00:00.000Z"),
      signing_secret: "sekrit",
    }));
    const count = vi.fn(async () => 1);
    const prisma = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({ projectWebhook: { count, create } }),
    };
    const result = await createProjectWebhook(prisma as never, "p1", {
      url: "https://hooks.example.com/a",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.webhook.urlMasked).toContain("***");
      expect(result.signingSecret).toBeTruthy();
    }
    expect(create).toHaveBeenCalledOnce();
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

  it("persists the same delivery id sent in the payload and header", async () => {
    const create = vi.fn(async () => ({ id: "log" }));
    let sentDeliveryId: string | undefined;
    let payloadDeliveryId: string | undefined;
    await sendTestWebhook(
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
        sendImpl: async (input) => {
          sentDeliveryId = input.deliveryId;
          payloadDeliveryId = (JSON.parse(input.body) as { deliveryId: string }).deliveryId;
          return { ok: true, httpStatus: 200, error: null };
        },
      }
    );
    expect(sentDeliveryId).toBeTruthy();
    expect(payloadDeliveryId).toBe(sentDeliveryId);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      data: { id: sentDeliveryId, status: "SUCCESS" },
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
