import { beforeEach, describe, expect, it, vi } from "vitest";

const fireProjectAlert = vi.fn(async () => true);
const loadProjectAlertSettings = vi.fn(async () => ({
  errorSpike: { enabled: true, threshold: 25, windowMinutes: 15 },
  quota: { enabled: false, nearPercent: 90 },
}));
const loadPlanContextForProject = vi.fn(async () => ({
  planTier: "FREE",
  limits: { monthlyIngestUnits: 250_000 },
}));
const getMonthlyIngestUsed = vi.fn(async () => 250_000);

vi.mock("./alert-dispatch.js", () => ({
  fireProjectAlert: (...args: unknown[]) => fireProjectAlert(...args),
}));

vi.mock("./error-spike-alert.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./error-spike-alert.js")>();
  return {
    ...actual,
    loadProjectAlertSettings: (...args: unknown[]) => loadProjectAlertSettings(...args),
  };
});

vi.mock("./plan-enforcement.js", () => ({
  loadPlanContextForProject: (...args: unknown[]) => loadPlanContextForProject(...args),
  getMonthlyIngestUsed: (...args: unknown[]) => getMonthlyIngestUsed(...args),
}));

import { maybeNotifyQuotaAlerts } from "./quota-alert.js";

describe("maybeNotifyQuotaAlerts", () => {
  beforeEach(() => {
    fireProjectAlert.mockClear();
    loadProjectAlertSettings.mockClear();
    loadPlanContextForProject.mockClear();
    getMonthlyIngestUsed.mockClear();
    loadProjectAlertSettings.mockResolvedValue({
      errorSpike: { enabled: true, threshold: 25, windowMinutes: 15 },
      quota: { enabled: false, nearPercent: 90 },
    });
    loadPlanContextForProject.mockResolvedValue({
      planTier: "FREE",
      limits: { monthlyIngestUnits: 250_000 },
    });
    getMonthlyIngestUsed.mockResolvedValue(250_000);
  });

  it("fires QUOTA_EXCEEDED when quota warnings are disabled", async () => {
    await maybeNotifyQuotaAlerts({} as never, "project-1");

    expect(fireProjectAlert).toHaveBeenCalledTimes(1);
    expect(fireProjectAlert).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ rule: "QUOTA_EXCEEDED", projectId: "project-1" })
    );
  });

  it("skips QUOTA_NEAR when quota warnings are disabled", async () => {
    getMonthlyIngestUsed.mockResolvedValueOnce(225_000);

    await maybeNotifyQuotaAlerts({} as never, "project-1");

    expect(fireProjectAlert).not.toHaveBeenCalled();
  });

  it("fires QUOTA_NEAR when quota warnings are enabled and usage is near the limit", async () => {
    loadProjectAlertSettings.mockResolvedValueOnce({
      errorSpike: { enabled: true, threshold: 25, windowMinutes: 15 },
      quota: { enabled: true, nearPercent: 90 },
    });
    getMonthlyIngestUsed.mockResolvedValueOnce(225_000);

    await maybeNotifyQuotaAlerts({} as never, "project-1");

    expect(fireProjectAlert).toHaveBeenCalledTimes(1);
    expect(fireProjectAlert).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ rule: "QUOTA_NEAR", projectId: "project-1" })
    );
  });

  it("swallows load failures so fire-and-forget ingest hooks stay rejection-safe", async () => {
    loadPlanContextForProject.mockRejectedValueOnce(
      new Error("Inconsistent query result: Field organization is required")
    );

    await expect(maybeNotifyQuotaAlerts({} as never, "project-1")).resolves.toBeUndefined();
    expect(fireProjectAlert).not.toHaveBeenCalled();
  });
});
