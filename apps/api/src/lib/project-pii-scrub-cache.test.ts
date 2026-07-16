import { describe, expect, it, vi, afterEach } from "vitest";
import {
  clearProjectPiiScrubSettingsCache,
  loadProjectPiiDenyKeys,
  projectPiiScrubCacheHas,
} from "./project-pii-scrub-cache.js";
import type { PrismaClient } from "@prisma/client";

describe("loadProjectPiiDenyKeys", () => {
  afterEach(() => {
    clearProjectPiiScrubSettingsCache();
    vi.restoreAllMocks();
  });

  it("caches deny keys per projectId and does not leak across projects", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ pii_scrub_settings: { denyKeys: ["a"] } })
      .mockResolvedValueOnce({ pii_scrub_settings: { denyKeys: ["b"] } });
    const prisma = { project: { findFirst } } as unknown as PrismaClient;

    expect(await loadProjectPiiDenyKeys(prisma, "proj-a", 1_000)).toEqual(["a"]);
    expect(await loadProjectPiiDenyKeys(prisma, "proj-b", 1_000)).toEqual(["b"]);
    expect(await loadProjectPiiDenyKeys(prisma, "proj-a", 1_500)).toEqual(["a"]);
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(projectPiiScrubCacheHas("proj-a")).toBe(true);
    expect(projectPiiScrubCacheHas("proj-b")).toBe(true);
  });

  it("invalidates a single project on clear", async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValue({ pii_scrub_settings: { denyKeys: ["x"] } });
    const prisma = { project: { findFirst } } as unknown as PrismaClient;
    await loadProjectPiiDenyKeys(prisma, "proj-1", 1_000);
    clearProjectPiiScrubSettingsCache("proj-1");
    expect(projectPiiScrubCacheHas("proj-1")).toBe(false);
    await loadProjectPiiDenyKeys(prisma, "proj-1", 1_100);
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it("returns empty denyKeys and keeps ingest available when Prisma fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const prisma = {
      project: {
        findFirst: vi.fn().mockRejectedValue(new Error("db down")),
      },
    } as unknown as PrismaClient;

    await expect(loadProjectPiiDenyKeys(prisma, "proj-x")).resolves.toEqual([]);
    expect(warn).toHaveBeenCalled();
    expect(projectPiiScrubCacheHas("proj-x")).toBe(false);
  });

  it("falls back safely for malformed stored JSON", async () => {
    const prisma = {
      project: {
        findFirst: vi.fn().mockResolvedValue({
          pii_scrub_settings: { denyKeys: "not-an-array" },
        }),
      },
    } as unknown as PrismaClient;
    await expect(loadProjectPiiDenyKeys(prisma, "proj-bad")).resolves.toEqual([]);
  });
});
