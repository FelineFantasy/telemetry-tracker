import { describe, expect, it } from "vitest";
import { BRIEF_RESPONSE_SCHEMA_VERSION } from "./brief-constants.js";
import type { BriefSnapshotRequest } from "./brief-contracts.js";
import {
  BriefSemanticCache,
  rebindCachedBriefResponse,
  type BriefCacheEntry,
} from "./brief-cache.js";
import { validatePrivateBriefResponse } from "./brief-validate-response.js";

const snapshot: BriefSnapshotRequest = {
  schemaVersion: "2026-07-brief-v1",
  requestId: "b0000000-0000-4000-8000-000000000003",
  generatedAt: "2026-07-14T12:34:00.000Z",
  organizationId: "c0000000-0000-4000-8000-000000000004",
  viewer: {},
  projects: [
    {
      projectId: "a0000000-0000-4000-8000-000000000001",
      projectName: "Acme",
      projectSlug: "acme",
      window: {
        since: "2026-07-07T12:34:00.000Z",
        until: "2026-07-14T12:34:00.000Z",
        previousSince: "2026-06-30T12:34:00.000Z",
        previousUntil: "2026-07-07T12:34:00.000Z",
        durationMs: 604_800_000,
      },
      kpis: {
        errors: { count: 1, previous: 0 },
        events: { count: 1, previous: 0 },
        sessions: { count: 1, previous: 0 },
        activeUsers: { count: 1, previous: 0 },
        errorRatePct: { value: 1, previous: 0 },
      },
      errorGroups: {
        firstSeenInWindow: [],
        byOccurrenceCount: [],
        byAbsoluteDelta: [],
      },
    },
  ],
};

function semanticEntry(): Omit<BriefCacheEntry, "cachedAt"> {
  return {
    contentHash: "a".repeat(64),
    presentationHash: "b".repeat(64),
    responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
    workspace: { title: "Workspace brief" },
    projects: [
      {
        projectId: "a0000000-0000-4000-8000-000000000001",
        significance: "low",
        collapsedLabel: "1 error",
      },
    ],
  };
}

describe("BriefSemanticCache", () => {
  it("keys entries by organizationId:contentHash:presentationHash:responseSchemaVersion", () => {
    const cache = new BriefSemanticCache();
    const key = {
      organizationId: snapshot.organizationId,
      contentHash: "a".repeat(64),
      presentationHash: "b".repeat(64),
      responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
    };
    cache.put(key, semanticEntry(), 1_000);
    expect(cache.get(key, 1_000)).not.toBeNull();

    const differentSchema = {
      ...key,
      responseSchemaVersion: "2026-99-brief-response-v9" as typeof BRIEF_RESPONSE_SCHEMA_VERSION,
    };
    expect(cache.get(differentSchema, 1_000)).toBeNull();
  });

  it("expires entries after TTL", () => {
    const cache = new BriefSemanticCache({ ttlMs: 1000 });
    const key = {
      organizationId: snapshot.organizationId,
      contentHash: "a".repeat(64),
      presentationHash: "b".repeat(64),
      responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
    };
    cache.put(key, semanticEntry(), 0);
    expect(cache.get(key, 500)).not.toBeNull();
    expect(cache.get(key, 1500)).toBeNull();
  });
});

describe("rebindCachedBriefResponse", () => {
  it("rebinds requestId, generatedAt, and generatedThrough from the snapshot", () => {
    const rebound = rebindCachedBriefResponse(
      snapshot,
      { ...semanticEntry(), cachedAt: 0 },
      "req-new",
      new Date("2026-07-14T12:34:10.000Z")
    );
    expect(rebound.requestId).toBe("req-new");
    expect(rebound.generatedAt).toBe("2026-07-14T12:34:10.000Z");
    expect(rebound.projects[0]!.generatedThrough).toBe("2026-07-14T12:34:00.000Z");
  });
});

describe("cache validation path", () => {
  it("rejects stale cached actions and evicts invalid cached response", () => {
    const cache = new BriefSemanticCache();
    const key = {
      organizationId: snapshot.organizationId,
      contentHash: "a".repeat(64),
      presentationHash: "b".repeat(64),
      responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
    };
    const stale = {
      ...semanticEntry(),
        projects: [
          {
            projectId: "a0000000-0000-4000-8000-000000000001",
            significance: "low",
            collapsedLabel: "1 error",
            suggestedNextStep: {
              type: "open_error_group",
              projectId: "00000000-0000-4000-8000-000000000099",
              errorGroupId: "d0000000-0000-4000-8000-000000000004",
            },
          },
        ],
    };
    cache.put(key, stale, 1_000);

    const entry = cache.get(key, 1_000)!;
    const rebound = rebindCachedBriefResponse(
      snapshot,
      entry,
      snapshot.requestId,
      new Date("2026-07-14T12:34:10.000Z")
    );
    const validated = validatePrivateBriefResponse(snapshot, rebound);
    expect(validated.ok).toBe(false);
    if (!validated.ok) {
      expect(validated.code).toBe("action_project_mismatch");
    }

    cache.evict(key);
    expect(cache.get(key, 1_000)).toBeNull();
  });
});
