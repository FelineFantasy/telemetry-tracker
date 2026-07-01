import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const consumeIngestRps = vi.fn(() => true);

vi.mock("./ingest-project-rps.js", () => ({
  consumeIngestRps: (...args: unknown[]) => consumeIngestRps(...args),
}));

const notifyQuotaThresholdEmail = vi.fn(async () => undefined);

vi.mock("./notification-email-dispatch.js", () => ({
  notifyQuotaThresholdEmail: (...args: unknown[]) => notifyQuotaThresholdEmail(...args),
}));

vi.mock("./db.js", () => ({
  prisma: {
    project: {
      findFirst: vi.fn(async () => ({
        organization_id: "org-1",
        organization: {
          plan_tier: "FREE",
          stripe_customer_id: null,
          stripe_subscription_status: null,
          stripe_current_period_end: null,
          deleted_at: null,
        },
      })),
    },
    usageMonthly: {
      findUnique: vi.fn(async () => ({ ingest_units: 250_000 })),
    },
    $queryRaw: vi.fn(async () => []),
  },
}));

import { assertIngestPlanOrReply } from "./plan-enforcement.js";
import { prisma } from "./db.js";

describe("assertIngestPlanOrReply", () => {
  beforeEach(() => {
    consumeIngestRps.mockClear();
    notifyQuotaThresholdEmail.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns monthly_ingest_quota before consuming RPS when quota is exceeded", async () => {
    const result = await assertIngestPlanOrReply(prisma, "project-1", 1, ["app-a"]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.body.code).toBe("monthly_ingest_quota");
    expect(consumeIngestRps).not.toHaveBeenCalled();
    expect(notifyQuotaThresholdEmail).toHaveBeenCalledWith(
      prisma,
      "project-1",
      "exceeded",
      expect.objectContaining({
        monthlyIngestUsed: 250_000,
        monthlyIngestLimit: 250_000,
      })
    );
  });

  it("does not send exceeded email when a batch would exceed but usage is below the cap", async () => {
    vi.mocked(prisma.usageMonthly.findUnique).mockResolvedValueOnce({
      ingest_units: 240_000,
    } as Awaited<ReturnType<typeof prisma.usageMonthly.findUnique>>);

    const result = await assertIngestPlanOrReply(prisma, "project-1", 20_000, ["app-a"]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.body.code).toBe("monthly_ingest_quota");
    expect(notifyQuotaThresholdEmail).not.toHaveBeenCalled();
  });
});
