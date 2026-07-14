import { describe, expect, it } from "vitest";
import { BriefServedMetaStore, briefServedMetaStore } from "./brief-served-meta.js";

const USER = "a0000000-0000-4000-8000-000000000001";
const ORG = "b0000000-0000-4000-8000-000000000002";
const REQUEST_A = "c0000000-0000-4000-8000-000000000003";
const REQUEST_B = "d0000000-0000-4000-8000-000000000004";
const REQUEST_C = "e0000000-0000-4000-8000-000000000005";
const SNAPSHOT_HASH = "a".repeat(64);

function meta(requestId: string) {
  return {
    requestId,
    snapshotHash: SNAPSHOT_HASH,
    organizationId: ORG,
    source: "ai" as const,
    projects: [
      {
        projectId: "f0000000-0000-4000-8000-000000000006",
        generatedThrough: "2026-07-14T12:00:00.000Z",
      },
    ],
  };
}

describe("BriefServedMetaStore", () => {
  it("stores and retrieves metadata by exact requestId", () => {
    const store = new BriefServedMetaStore();
    store.store(USER, meta(REQUEST_A), 1_000);
    expect(store.get(USER, ORG, REQUEST_A, 1_000)?.requestId).toBe(REQUEST_A);
    expect(store.get(USER, ORG, REQUEST_B, 1_000)).toBeNull();
  });

  it("expires entries after TTL", () => {
    const store = new BriefServedMetaStore({ ttlMs: 1000 });
    store.store(USER, meta(REQUEST_A), 1_000);
    expect(store.get(USER, ORG, REQUEST_A, 2_001)).toBeNull();
  });

  it("retains multiple tabs up to the per-user cap", () => {
    const store = new BriefServedMetaStore({ maxPerUserOrg: 2, ttlMs: 60_000 });
    store.store(USER, meta(REQUEST_A), 1_000);
    store.store(USER, meta(REQUEST_B), 2_000);
    store.store(USER, meta(REQUEST_C), 3_000);

    const listed = store.listForUserOrg(USER, ORG, 3_000);
    expect(listed.map((entry) => entry.requestId)).toEqual([REQUEST_C, REQUEST_B]);
    expect(store.get(USER, ORG, REQUEST_A, 3_000)).toBeNull();
    expect(store.get(USER, ORG, REQUEST_B, 3_000)?.requestId).toBe(REQUEST_B);
    expect(store.get(USER, ORG, REQUEST_C, 3_000)?.requestId).toBe(REQUEST_C);
  });

  it("isolates entries by user and organization", () => {
    const store = new BriefServedMetaStore();
    store.store(USER, meta(REQUEST_A), 1_000);
    const otherOrg = "00000000-0000-4000-8000-000000000099";
    expect(store.get(USER, otherOrg, REQUEST_A, 1_000)).toBeNull();
  });

  it("prunes expired entries during store", () => {
    const store = new BriefServedMetaStore({ ttlMs: 1000 });
    store.store(USER, meta(REQUEST_A), 1_000);
    store.store(USER, meta(REQUEST_B), 3_000);
    expect(store.size()).toBe(1);
  });
});

describe("briefServedMetaStore singleton", () => {
  it("is usable as a process-wide store", () => {
    expect(briefServedMetaStore).toBeInstanceOf(BriefServedMetaStore);
  });
});
