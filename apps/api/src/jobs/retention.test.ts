import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanTier } from "@prisma/client";
import { runRetentionSweep } from "./retention.js";

describe("runRetentionSweep", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("expires sessions by end time so open long-running sessions are retained", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-06T10:00:00.000Z"));

    const sessionDeleteMany = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      // Simulate one old closed session and one old still-open session. A started_at
      // predicate would delete both; ended_at deletes only the closed one.
      return { count: "ended_at" in where ? 1 : 2 };
    });
    const tx = {
      errorOccurrence: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      event: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      session: { deleteMany: sessionDeleteMany },
      errorGroup: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      $executeRaw: vi.fn(async () => 0),
    };
    const prisma = {
      project: {
        findMany: vi.fn(async () => [
          {
            id: "project-1",
            organization: {
              plan_tier: PlanTier.FREE,
              stripe_subscription_status: null,
              deleted_at: null,
            },
          },
        ]),
      },
      $transaction: vi.fn(async (fn: (txArg: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const result = await runRetentionSweep(prisma as never);

    expect(result.sessionsDeleted).toBe(1);
    expect(sessionDeleteMany).toHaveBeenCalledWith({
      where: {
        project_id: "project-1",
        ended_at: { lt: new Date("2026-04-22T10:00:00.000Z") },
      },
    });
  });
});
