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
  resolveAlertWebhookWorkerLeaseMs,
  resolveWebhookHostForDelivery,
  finalizeTestWebhookDelivery,
  sendTestWebhook,
  signWebhookBody,
  validateWebhookUrl,
  WEBHOOK_DNS_TIMEOUT_MS,
  WEBHOOK_FETCH_TIMEOUT_MS,
  WEBHOOK_LEASE_POST_MARGIN_MS,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_WORKER_LEASE_MS_DEFAULT,
  webhookDeliveryLeaseMinimumMs,
  type WebhookDnsLookup,
} from "./alert-webhook-dispatch.js";
import {
  abandonExpiredTestWebhookDeliveries,
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

  it("times out a hung DNS resolver", async () => {
    vi.useFakeTimers();
    try {
      const hungLookup: WebhookDnsLookup = () => new Promise(() => {});
      const pending = resolveWebhookHostForDelivery("slow.example", hungLookup);
      const expectation = expect(pending).resolves.toEqual({
        ok: false,
        error: "Webhook URL host DNS lookup timed out",
      });
      await vi.advanceTimersByTimeAsync(WEBHOOK_DNS_TIMEOUT_MS);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces DNS timeout from postWebhookOnce before HTTPS", async () => {
    vi.useFakeTimers();
    try {
      const hungLookup: WebhookDnsLookup = () => new Promise(() => {});
      const pending = postWebhookOnce(
        "https://slow.example/hook",
        "{}",
        null,
        "d1",
        { lookupFn: hungLookup }
      );
      const expectation = expect(pending).resolves.toEqual({
        ok: false,
        httpStatus: null,
        error: "Webhook URL host DNS lookup timed out",
      });
      await vi.advanceTimersByTimeAsync(WEBHOOK_DNS_TIMEOUT_MS);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
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
    expect(row?.attemptChargedOnClaim).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attempt: { increment: 1 } }),
      })
    );
  });

  it("reclaims expired PROCESSING without incrementing attempt", async () => {
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
      lease_owner: "w2",
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
              attempt: 1,
              status: "PROCESSING",
              http_status: null,
              error: null,
              lease_owner: "w1",
              lease_expires_at: new Date("2026-07-17T11:59:00.000Z"),
              next_attempt_at: new Date("2026-07-17T12:00:00.000Z"),
              created_at: new Date("2026-07-17T12:00:00.000Z"),
              updated_at: new Date("2026-07-17T12:00:00.000Z"),
            },
          ],
          alertWebhookDelivery: { update },
        }),
    };
    const row = await claimNextAlertWebhookDelivery(prisma as never, {
      workerId: "w2",
      now: new Date("2026-07-17T12:00:00.000Z"),
    });
    expect(row?.attempt).toBe(1);
    expect(row?.attemptChargedOnClaim).toBe(false);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ attempt: expect.anything() }),
      })
    );
  });

  it("excludes webhook:test: deliveries from claim SQL", async () => {
    let capturedSql: { strings: string[] } | null = null;
    const prisma = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: async (sql: { strings: string[] }) => {
            capturedSql = sql;
            return [];
          },
          alertWebhookDelivery: { update: vi.fn() },
        }),
    };
    await claimNextAlertWebhookDelivery(prisma as never, {
      workerId: "w1",
      now: new Date("2026-07-17T12:00:00.000Z"),
    });
    const text = capturedSql?.strings.join("?") ?? "";
    expect(text).toContain(`"dedupe_key" NOT LIKE 'webhook:test:%'`);
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

  it("abandons expired webhook:test PROCESSING rows without POSTing", async () => {
    const updateMany = vi.fn(async () => ({ count: 2 }));
    const now = new Date("2026-07-17T12:00:00.000Z");
    const count = await abandonExpiredTestWebhookDeliveries(
      { alertWebhookDelivery: { updateMany } } as never,
      { now }
    );
    expect(count).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: "PROCESSING",
        dedupe_key: { startsWith: "webhook:test:" },
        OR: [{ lease_expires_at: { lt: now } }, { lease_expires_at: null }],
      },
      data: {
        status: "FAILED",
        error: "Test delivery abandoned (interrupted before finalize)",
        lease_owner: null,
        lease_expires_at: null,
      },
    });
  });
});

describe("processNextAlertWebhookDelivery", () => {
  it("posts signed payload and marks SUCCESS", async () => {
    const sendImpl = vi.fn(async () => ({ ok: true as const, httpStatus: 200 }));
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 0 }) // abandon expired tests
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
    expect(updateMany).toHaveBeenCalledTimes(3);
  });

  it("does not report success when completion loses the lease", async () => {
    const sendImpl = vi.fn(async () => ({ ok: true as const, httpStatus: 200 }));
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 0 }) // abandon expired tests
      .mockResolvedValueOnce({ count: 1 }) // renew
      .mockResolvedValueOnce({ count: 0 }) // lease-scoped complete missed
      .mockResolvedValueOnce({ count: 1 }); // finalize SUCCESS without lease
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
    expect(result).toEqual({ status: "success", deliveryId: "d1" });
    expect(sendImpl).toHaveBeenCalledOnce();
    expect(updateMany).toHaveBeenCalledTimes(4);
  });

  it("force-terminalizes SUCCESS when complete and scoped finalize miss after POST", async () => {
    const sendImpl = vi.fn(async () => ({ ok: true as const, httpStatus: 200 }));
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 0 }) // abandon expired tests
      .mockResolvedValueOnce({ count: 1 }) // renew
      .mockResolvedValueOnce({ count: 0 }) // lease-scoped complete
      .mockResolvedValueOnce({ count: 0 }); // PROCESSING-scoped finalize missed
    const update = vi.fn().mockResolvedValue({
      id: "d1",
      status: "SUCCESS",
      http_status: 200,
      error: null,
      lease_owner: null,
      lease_expires_at: null,
    });
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
      alertWebhookDelivery: { updateMany, update },
    };
    const result = await processNextAlertWebhookDelivery({
      prisma: prisma as never,
      workerId: "worker-1",
      now: () => new Date("2026-07-17T12:00:00.000Z"),
      sendImpl,
    });
    expect(result).toEqual({ status: "success", deliveryId: "d1" });
    expect(sendImpl).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: {
        status: "SUCCESS",
        http_status: 200,
        error: null,
        lease_owner: null,
        lease_expires_at: null,
      },
    });
  });

  it("skips POST when the lease cannot be renewed", async () => {
    const sendImpl = vi.fn(async () => ({ ok: true as const, httpStatus: 200 }));
    // renew miss, then releaseAlertWebhookDeliveryClaim also misses (reclaimed)
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 0 }) // abandon expired tests
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
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
    expect(updateMany).toHaveBeenCalledTimes(3);
  });

  it("clears PROCESSING when lease renew fails but ownership remains", async () => {
    const sendImpl = vi.fn(async () => ({ ok: true as const, httpStatus: 200 }));
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 0 }) // abandon expired tests
      .mockResolvedValueOnce({ count: 0 })
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
    expect(updateMany).toHaveBeenCalledTimes(3);
    expect(updateMany.mock.calls[2][0].data).toMatchObject({
      status: "FAILED",
      error: "Lease lost before delivery",
      lease_owner: null,
      lease_expires_at: null,
      attempt: { decrement: 1 },
    });
  });

  it("reclaimed PROCESSING HTTP failure keeps attempt and stays FAILED not DEAD", async () => {
    const sendImpl = vi.fn(async () => ({
      ok: false as const,
      httpStatus: 500,
      error: "HTTP 500",
    }));
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 0 }) // abandon expired tests
      .mockResolvedValueOnce({ count: 1 }) // renew
      .mockResolvedValueOnce({ count: 1 }); // fail
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
              attempt: 1,
              status: "PROCESSING",
              http_status: null,
              error: null,
              lease_owner: "crashed-worker",
              lease_expires_at: new Date("2026-07-17T11:59:00.000Z"),
              next_attempt_at: new Date("2026-07-17T12:00:00.000Z"),
              created_at: new Date("2026-07-17T12:00:00.000Z"),
              updated_at: new Date("2026-07-17T12:00:00.000Z"),
            },
          ],
          alertWebhookDelivery: {
            update: async (args: { data: Record<string, unknown> }) => {
              expect(args.data).not.toHaveProperty("attempt");
              return {
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
              };
            },
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
      error: "HTTP 500",
    });
    expect(sendImpl).toHaveBeenCalledOnce();
    expect(updateMany.mock.calls[2][0].data).toMatchObject({
      status: "FAILED",
    });
    expect(updateMany.mock.calls[2][0].data.status).not.toBe("DEAD");
  });

  it("does not undo attempt when renew misses after PROCESSING reclaim", async () => {
    const sendImpl = vi.fn(async () => ({ ok: true as const, httpStatus: 200 }));
    const updateMany = vi
      .fn()
      .mockResolvedValueOnce({ count: 0 }) // abandon expired tests
      .mockResolvedValueOnce({ count: 0 })
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
              attempt: 1,
              status: "PROCESSING",
              http_status: null,
              error: null,
              lease_owner: "crashed-worker",
              lease_expires_at: new Date("2026-07-17T11:59:00.000Z"),
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
    expect(updateMany.mock.calls[2][0].data).toMatchObject({
      status: "FAILED",
      error: "Lease lost before delivery",
    });
    expect(updateMany.mock.calls[2][0].data).not.toHaveProperty("attempt");
  });

  it("does not POST a generic payload when alert_event_id is null", async () => {
    const sendImpl = vi.fn(async () => ({ ok: true as const, httpStatus: 200 }));
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          $queryRaw: async () => [
            {
              id: "d-test",
              webhook_id: "wh1",
              project_id: "p1",
              alert_event_id: null,
              dedupe_key: "webhook:test:wh1:d-test",
              attempt: 0,
              status: "PROCESSING",
              http_status: null,
              error: null,
              lease_owner: "test-webhook:d-test",
              lease_expires_at: new Date("2026-07-17T11:00:00.000Z"),
              next_attempt_at: new Date("2026-07-17T12:00:00.000Z"),
              created_at: new Date("2026-07-17T12:00:00.000Z"),
              updated_at: new Date("2026-07-17T12:00:00.000Z"),
            },
          ],
          alertWebhookDelivery: {
            update: async () => ({
              id: "d-test",
              webhook_id: "wh1",
              project_id: "p1",
              alert_event_id: null,
              dedupe_key: "webhook:test:wh1:d-test",
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
      alertEvent: { findUnique: vi.fn() },
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
      deliveryId: "d-test",
      terminal: "DEAD",
      error: "Alert event missing",
    });
    expect(sendImpl).not.toHaveBeenCalled();
    expect(prisma.alertEvent.findUnique).not.toHaveBeenCalled();
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

describe("resolveAlertWebhookWorkerLeaseMs", () => {
  it("defaults to 30s and clamps below DNS+POST timeout plus margin", () => {
    const minLease = webhookDeliveryLeaseMinimumMs();
    expect(minLease).toBe(
      WEBHOOK_DNS_TIMEOUT_MS + WEBHOOK_FETCH_TIMEOUT_MS + WEBHOOK_LEASE_POST_MARGIN_MS
    );
    expect(resolveAlertWebhookWorkerLeaseMs({})).toBe(WEBHOOK_WORKER_LEASE_MS_DEFAULT);
    expect(resolveAlertWebhookWorkerLeaseMs({ ALERT_WEBHOOK_WORKER_LEASE_MS: "5000" })).toBe(
      minLease
    );
    expect(resolveAlertWebhookWorkerLeaseMs({ ALERT_WEBHOOK_WORKER_LEASE_MS: "8000" })).toBe(
      minLease
    );
    expect(resolveAlertWebhookWorkerLeaseMs({ ALERT_WEBHOOK_WORKER_LEASE_MS: "15000" })).toBe(
      minLease
    );
    expect(resolveAlertWebhookWorkerLeaseMs({ ALERT_WEBHOOK_WORKER_LEASE_MS: "45000" })).toBe(45_000);
    expect(resolveAlertWebhookWorkerLeaseMs({ ALERT_WEBHOOK_WORKER_LEASE_MS: "nope" })).toBe(
      WEBHOOK_WORKER_LEASE_MS_DEFAULT
    );
  });
});

describe("sendTestWebhook", () => {
  it("logs single-shot failures as FAILED not DEAD", async () => {
    const create = vi.fn(async () => ({ id: "log" }));
    const update = vi.fn(async () => ({ id: "log" }));
    const result = await sendTestWebhook(
      {
        projectWebhook: {
          findFirst: async () => ({
            id: "wh1",
            url: "https://hooks.example.com/a",
            signing_secret: null,
          }),
        },
        alertWebhookDelivery: { create, update },
      } as never,
      "p1",
      "wh1",
      {
        sendImpl: async () => ({ ok: false, httpStatus: 500, error: "HTTP 500" }),
      }
    );
    expect(result.ok).toBe(false);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      data: { status: "PROCESSING", attempt: 1 },
    });
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      data: { status: "FAILED", lease_owner: null },
    });
  });

  it("persists the delivery row before POSTing", async () => {
    const order: string[] = [];
    const create = vi.fn(async () => {
      order.push("create");
      return { id: "log" };
    });
    const update = vi.fn(async () => {
      order.push("update");
      return { id: "log" };
    });
    await sendTestWebhook(
      {
        projectWebhook: {
          findFirst: async () => ({
            id: "wh1",
            url: "https://hooks.example.com/a",
            signing_secret: null,
          }),
        },
        alertWebhookDelivery: { create, update },
      } as never,
      "p1",
      "wh1",
      {
        sendImpl: async () => {
          order.push("post");
          return { ok: true, httpStatus: 200 };
        },
      }
    );
    expect(order).toEqual(["create", "post", "update"]);
  });

  it("persists the same delivery id sent in the payload and header", async () => {
    const create = vi.fn(async () => ({ id: "log" }));
    const update = vi.fn(async () => ({ id: "log" }));
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
        alertWebhookDelivery: { create, update },
      } as never,
      "p1",
      "wh1",
      {
        sendImpl: async (input) => {
          sentDeliveryId = input.deliveryId;
          payloadDeliveryId = (JSON.parse(input.body) as { deliveryId: string }).deliveryId;
          return { ok: true, httpStatus: 200 };
        },
      }
    );
    expect(sentDeliveryId).toBeTruthy();
    expect(payloadDeliveryId).toBe(sentDeliveryId);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      data: { id: sentDeliveryId, status: "PROCESSING" },
    });
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: sentDeliveryId },
      data: { status: "SUCCESS" },
    });
  });

  it("does not POST when creating the delivery row fails", async () => {
    const sendImpl = vi.fn(async () => ({ ok: true, httpStatus: 200 }));
    await expect(
      sendTestWebhook(
        {
          projectWebhook: {
            findFirst: async () => ({
              id: "wh1",
              url: "https://hooks.example.com/a",
              signing_secret: null,
            }),
          },
          alertWebhookDelivery: {
            create: async () => {
              throw new Error("db unavailable");
            },
            update: vi.fn(),
          },
        } as never,
        "p1",
        "wh1",
        { sendImpl }
      )
    ).rejects.toThrow("db unavailable");
    expect(sendImpl).not.toHaveBeenCalled();
  });

  it("retries terminal status update after transient DB failure", async () => {
    const update = vi
      .fn()
      .mockRejectedValueOnce(new Error("db blip"))
      .mockResolvedValueOnce({ id: "log" });
    const result = await sendTestWebhook(
      {
        projectWebhook: {
          findFirst: async () => ({
            id: "wh1",
            url: "https://hooks.example.com/a",
            signing_secret: null,
          }),
        },
        alertWebhookDelivery: {
          create: async () => ({ id: "log" }),
          update,
        },
      } as never,
      "p1",
      "wh1",
      {
        sendImpl: async () => ({ ok: true, httpStatus: 200 }),
      }
    );
    expect(result).toEqual({ ok: true, httpStatus: 200 });
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1]?.[0]).toMatchObject({
      data: { status: "SUCCESS", lease_owner: null },
    });
  });

  it("falls back to FAILED when SUCCESS finalize keeps failing", async () => {
    const update = vi
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockRejectedValueOnce(new Error("db down"))
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce({ id: "log" });
    const result = await sendTestWebhook(
      {
        projectWebhook: {
          findFirst: async () => ({
            id: "wh1",
            url: "https://hooks.example.com/a",
            signing_secret: null,
          }),
        },
        alertWebhookDelivery: {
          create: async () => ({ id: "log" }),
          update,
        },
      } as never,
      "p1",
      "wh1",
      {
        sendImpl: async () => ({ ok: true, httpStatus: 200 }),
      }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Could not finalize delivery status");
      expect(result.status).toBe(502);
    }
    expect(update).toHaveBeenCalledTimes(4);
    expect(update.mock.calls[3]?.[0]).toMatchObject({
      data: { status: "FAILED", lease_owner: null },
    });
  });

  it("marks FAILED when sendImpl throws so the row is not left PROCESSING", async () => {
    const update = vi.fn(async () => ({ id: "log" }));
    const result = await sendTestWebhook(
      {
        projectWebhook: {
          findFirst: async () => ({
            id: "wh1",
            url: "https://hooks.example.com/a",
            signing_secret: null,
          }),
        },
        alertWebhookDelivery: {
          create: async () => ({ id: "log" }),
          update,
        },
      } as never,
      "p1",
      "wh1",
      {
        sendImpl: async () => {
          throw new Error("socket hang up");
        },
      }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("socket hang up");
      expect(result.status).toBe(502);
    }
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      data: { status: "FAILED", error: "socket hang up", lease_owner: null },
    });
  });
});

describe("finalizeTestWebhookDelivery", () => {
  it("returns false when every update attempt fails", async () => {
    const update = vi.fn().mockRejectedValue(new Error("db down"));
    const ok = await finalizeTestWebhookDelivery(
      { alertWebhookDelivery: { update } } as never,
      "d1",
      { status: "SUCCESS", http_status: 200, error: null }
    );
    expect(ok).toBe(false);
    // 3 intended SUCCESS retries + 1 FAILED last resort
    expect(update).toHaveBeenCalledTimes(4);
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
