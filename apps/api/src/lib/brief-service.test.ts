import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRIEF_CIRCUIT_FAILURE_THRESHOLD, BRIEF_RESPONSE_SCHEMA_VERSION } from "./brief-constants.js";
import type { BriefSnapshotRequest } from "./brief-contracts.js";
import * as authz from "./brief-authz.js";
import * as client from "./brief-client.js";
import { BriefSemanticCache } from "./brief-cache.js";
import { BriefServedMetaStore } from "./brief-served-meta.js";
import { computePresentationHash } from "./brief-presentation-hash.js";
import { resetBriefCircuitBreakers, getBriefCircuitBreaker } from "./brief-circuit.js";
import { getWorkspaceBrief } from "./brief-service.js";
import * as snapshot from "./brief-snapshot.js";

const USER_ID = "f0000000-0000-4000-8000-000000000010";
const ORG_ID = "e0000000-0000-4000-8000-000000000005";
const PROJECT_ID = "a0000000-0000-4000-8000-000000000001";
const DROPPED_PROJECT_ID = "b0000000-0000-4000-8000-000000000002";

const builtSnapshot: BriefSnapshotRequest = {
  schemaVersion: "2026-07-brief-v1",
  requestId: "req-snapshot",
  generatedAt: "2026-07-14T12:34:00.000Z",
  organizationId: ORG_ID,
  viewer: {},
  projects: [
    {
      projectId: PROJECT_ID,
      projectName: "Alpha",
      projectSlug: "alpha",
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

const buildMeta = {
  truncated: false,
  truncationSteps: [] as string[],
  droppedProjectIds: [] as string[],
  byteLength: 100,
};

const validAiResponse = {
  schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
  requestId: "ignored-until-rebind",
  generatedAt: "2026-07-14T12:34:00.000Z",
  workspace: { title: "Workspace brief" },
  projects: [
    {
      projectId: PROJECT_ID,
      generatedThrough: "2026-07-14T12:34:00.000Z",
      significance: "low" as const,
      collapsedLabel: "1 error",
    },
  ],
};

const prisma = {} as never;
const fixedNow = new Date("2026-07-14T12:34:15.789Z");
const secretB64 = Buffer.alloc(32, 7).toString("base64");

function serviceDeps(
  cache: BriefSemanticCache,
  servedMeta: BriefServedMetaStore,
  env?: NodeJS.ProcessEnv
) {
  return {
    prisma,
    env: env ?? {
      TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
      TELEMETRY_AI_BRIEF_SECRET: secretB64,
    },
    now: () => fixedNow,
    cache,
    servedMeta,
  };
}

describe("getWorkspaceBrief", () => {
  let cache: BriefSemanticCache;
  let servedMeta: BriefServedMetaStore;

  beforeEach(() => {
    cache = new BriefSemanticCache();
    servedMeta = new BriefServedMetaStore();
    resetBriefCircuitBreakers();
    vi.restoreAllMocks();

    vi.spyOn(authz, "authorizeWorkspaceBrief").mockResolvedValue({
      ok: true,
      organizationId: ORG_ID,
      organizationName: "Acme Corp",
      projects: [
        {
          id: PROJECT_ID,
          name: "Alpha",
          slug: "alpha",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    });

    vi.spyOn(snapshot, "buildWorkspaceBriefSnapshot").mockImplementation(async (_prisma, input) => ({
      ok: true,
      snapshot: { ...builtSnapshot, requestId: input.requestId },
      contentHash: "c".repeat(64),
      snapshotHash: "d".repeat(64),
      meta: buildMeta,
    }));

    vi.spyOn(client, "postWorkspaceBrief").mockImplementation(async (snap) => ({
      ok: true,
      response: {
        ...validAiResponse,
        requestId: snap.requestId,
      },
      attempts: 1,
      latencyMs: 10,
    }));
  });

  it("uses bucketed requestUntil when building the snapshot", async () => {
    await getWorkspaceBrief({
      prisma,
      env: {
        TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
        TELEMETRY_AI_BRIEF_SECRET: secretB64,
      },
      now: () => fixedNow,
      cache,
      servedMeta,
    }, { userId: USER_ID, organizationId: ORG_ID });

    expect(snapshot.buildWorkspaceBriefSnapshot).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        requestUntil: new Date("2026-07-14T12:34:00.000Z"),
      })
    );
  });

  it("serves a cache hit without calling the AI client", async () => {
    const postSpy = vi.spyOn(client, "postWorkspaceBrief");

    const first = await getWorkspaceBrief({
      prisma,
      env: {
        TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
        TELEMETRY_AI_BRIEF_SECRET: secretB64,
      },
      now: () => fixedNow,
      cache,
      servedMeta,
    }, { userId: USER_ID, organizationId: ORG_ID });

    expect(first.status).toBe("ok");
    if (first.status !== "ok") return;
    expect(first.meta.source).toBe("ai");
    expect(postSpy).toHaveBeenCalledTimes(1);

    const second = await getWorkspaceBrief({
      prisma,
      env: {
        TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
        TELEMETRY_AI_BRIEF_SECRET: secretB64,
      },
      now: () => fixedNow,
      cache,
      servedMeta,
    }, { userId: USER_ID, organizationId: ORG_ID });

    expect(second.status).toBe("ok");
    if (second.status !== "ok") return;
    expect(second.meta.source).toBe("cache");
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(servedMeta.listForUserOrg(USER_ID, ORG_ID)).toHaveLength(2);
  });

  it("evicts invalid cache entries and retries AI instead of falling back", async () => {
    const postSpy = vi.spyOn(client, "postWorkspaceBrief").mockImplementation(async (snap) => ({
      ok: true,
      response: {
        ...validAiResponse,
        requestId: snap.requestId,
      },
      attempts: 1,
      latencyMs: 10,
    }));

    await getWorkspaceBrief({
      prisma,
      env: {
        TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
        TELEMETRY_AI_BRIEF_SECRET: secretB64,
      },
      now: () => fixedNow,
      cache,
      servedMeta,
    }, { userId: USER_ID, organizationId: ORG_ID });
    expect(postSpy).toHaveBeenCalledTimes(1);

    const presentationHash = computePresentationHash({
      organizationId: ORG_ID,
      organizationName: "Acme Corp",
      projects: [{ projectId: PROJECT_ID, projectName: "Alpha", projectSlug: "alpha" }],
    });
    cache.put(
      {
        organizationId: ORG_ID,
        contentHash: "c".repeat(64),
        presentationHash,
        responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      },
      {
        contentHash: "c".repeat(64),
        presentationHash,
        responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
        workspace: { title: "Workspace brief" },
        projects: [
          {
            projectId: PROJECT_ID,
            significance: "low",
            collapsedLabel: "1 error",
            suggestedNextStep: {
              type: "open_error_group",
              projectId: "00000000-0000-4000-8000-000000000099",
              errorGroupId: "d0000000-0000-4000-8000-000000000004",
            },
          },
        ],
      },
      fixedNow.getTime()
    );

    const second = await getWorkspaceBrief({
      prisma,
      env: {
        TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
        TELEMETRY_AI_BRIEF_SECRET: secretB64,
      },
      now: () => fixedNow,
      cache,
      servedMeta,
    }, { userId: USER_ID, organizationId: ORG_ID });

    expect(second.status).toBe("ok");
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it("evicts cache entries that fail rebind and retries AI", async () => {
    const postSpy = vi.spyOn(client, "postWorkspaceBrief").mockImplementation(async (snap) => ({
      ok: true,
      response: {
        ...validAiResponse,
        requestId: snap.requestId,
      },
      attempts: 1,
      latencyMs: 10,
    }));

    await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });
    expect(postSpy).toHaveBeenCalledTimes(1);

    const presentationHash = computePresentationHash({
      organizationId: ORG_ID,
      organizationName: "Acme Corp",
      projects: [{ projectId: PROJECT_ID, projectName: "Alpha", projectSlug: "alpha" }],
    });
    cache.put(
      {
        organizationId: ORG_ID,
        contentHash: "c".repeat(64),
        presentationHash,
        responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
      },
      {
        contentHash: "c".repeat(64),
        presentationHash,
        responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
        workspace: { title: "Workspace brief" },
        projects: [
          {
            projectId: "00000000-0000-4000-8000-000000000099",
            significance: "low",
            collapsedLabel: "orphan project",
          },
        ],
      },
      fixedNow.getTime()
    );

    const second = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(second.status).toBe("ok");
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it("does not store served metadata for fallback responses", async () => {
    vi.spyOn(client, "postWorkspaceBrief").mockResolvedValue({
      ok: false,
      reason: "network",
      message: "down",
      attempts: 1,
      latencyMs: 5,
    });

    const result = await getWorkspaceBrief(
      serviceDeps(cache, servedMeta),
      { userId: USER_ID, organizationId: ORG_ID }
    );

    expect(result.status).toBe("unavailable");
    expect(servedMeta.listForUserOrg(USER_ID, ORG_ID)).toHaveLength(0);
  });

  it("leaves no served-meta entry that could acknowledge a fallback brief", async () => {
    vi.spyOn(client, "postWorkspaceBrief").mockResolvedValue({
      ok: false,
      reason: "network",
      message: "down",
      attempts: 1,
      latencyMs: 5,
    });

    const result = await getWorkspaceBrief(
      serviceDeps(cache, servedMeta),
      { userId: USER_ID, organizationId: ORG_ID }
    );

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(servedMeta.get(USER_ID, ORG_ID, result.requestId)).toBeNull();
  });

  it("falls back only when AI retry fails after invalid cache eviction", async () => {
    const postSpy = vi.spyOn(client, "postWorkspaceBrief").mockResolvedValue({
      ok: false,
      reason: "network",
      message: "down",
      attempts: 1,
      latencyMs: 5,
    });

    const presentationHash = computePresentationHash({
      organizationId: ORG_ID,
      organizationName: "Acme Corp",
      projects: [{ projectId: PROJECT_ID, projectName: "Alpha", projectSlug: "alpha" }],
    });
    const cacheKey = {
      organizationId: ORG_ID,
      contentHash: "c".repeat(64),
      presentationHash,
      responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
    };
    cache.put(
      cacheKey,
      {
        contentHash: "c".repeat(64),
        presentationHash,
        responseSchemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
        workspace: { title: "Workspace brief" },
        projects: [
          {
            projectId: PROJECT_ID,
            significance: "low",
            collapsedLabel: "1 error",
            suggestedNextStep: {
              type: "open_error_group",
              projectId: "00000000-0000-4000-8000-000000000099",
              errorGroupId: "d0000000-0000-4000-8000-000000000004",
            },
          },
        ],
      },
      fixedNow.getTime()
    );

    const result = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe("ai_unreachable");
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(cache.get(cacheKey, fixedNow.getTime())).toBeNull();
  });

  it("assigns a new requestId on cache hits", async () => {
    const first = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });
    const second = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(first.status).toBe("ok");
    expect(second.status).toBe("ok");
    if (first.status !== "ok" || second.status !== "ok") return;
    expect(first.requestId).not.toBe(second.requestId);
    expect(second.meta.source).toBe("cache");
  });

  it("stores each served request independently for multi-tab acknowledgement", async () => {
    await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });
    await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    const entries = servedMeta.listForUserOrg(USER_ID, ORG_ID);
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((entry) => entry.requestId)).size).toBe(2);
  });

  it("excludes dropped projects from served metadata", async () => {
    vi.spyOn(snapshot, "buildWorkspaceBriefSnapshot").mockImplementation(async (_prisma, input) => ({
      ok: true,
      snapshot: { ...builtSnapshot, requestId: input.requestId },
      contentHash: "c".repeat(64),
      snapshotHash: "d".repeat(64),
      meta: {
        ...buildMeta,
        droppedProjectIds: [DROPPED_PROJECT_ID],
      },
    }));

    await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    const stored = servedMeta.listForUserOrg(USER_ID, ORG_ID)[0]!;
    expect(stored.projects.map((p) => p.projectId)).toEqual([PROJECT_ID]);
    expect(stored.projects.some((p) => p.projectId === DROPPED_PROJECT_ID)).toBe(false);
  });

  it("returns droppedProjectIds in ok responses", async () => {
    vi.spyOn(snapshot, "buildWorkspaceBriefSnapshot").mockImplementation(async (_prisma, input) => ({
      ok: true,
      snapshot: { ...builtSnapshot, requestId: input.requestId },
      contentHash: "c".repeat(64),
      snapshotHash: "d".repeat(64),
      meta: {
        ...buildMeta,
        droppedProjectIds: [DROPPED_PROJECT_ID],
      },
    }));

    const result = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.meta.droppedProjectIds).toEqual([DROPPED_PROJECT_ID]);
  });

  it("returns droppedProjectIds in unavailable responses", async () => {
    vi.spyOn(snapshot, "buildWorkspaceBriefSnapshot").mockImplementation(async (_prisma, input) => ({
      ok: true,
      snapshot: { ...builtSnapshot, requestId: input.requestId },
      contentHash: "c".repeat(64),
      snapshotHash: "d".repeat(64),
      meta: {
        ...buildMeta,
        droppedProjectIds: [DROPPED_PROJECT_ID],
      },
    }));
    vi.spyOn(client, "postWorkspaceBrief").mockResolvedValue({
      ok: false,
      reason: "network",
      message: "down",
      attempts: 1,
      latencyMs: 5,
    });

    const result = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.meta.droppedProjectIds).toEqual([DROPPED_PROJECT_ID]);
  });

  it("maps private 401 responses to ai_misconfigured", async () => {
    vi.spyOn(client, "postWorkspaceBrief").mockResolvedValue({
      ok: false,
      reason: "http_error",
      status: 401,
      message: "AI HTTP 401",
      attempts: 1,
      latencyMs: 5,
    });

    const result = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe("ai_misconfigured");
  });

  it("maps private 403 responses to ai_misconfigured", async () => {
    vi.spyOn(client, "postWorkspaceBrief").mockResolvedValue({
      ok: false,
      reason: "http_error",
      status: 403,
      message: "AI HTTP 403",
      attempts: 1,
      latencyMs: 5,
    });

    const result = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe("ai_misconfigured");
  });

  it("maps private 409 responses to ai_idempotency_conflict", async () => {
    vi.spyOn(client, "postWorkspaceBrief").mockResolvedValue({
      ok: false,
      reason: "http_error",
      status: 409,
      message: "AI HTTP 409",
      attempts: 1,
      latencyMs: 5,
    });

    const result = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe("ai_idempotency_conflict");
  });

  it("does not count ai_idempotency_conflict as a circuit failure", async () => {
    const breaker = getBriefCircuitBreaker("http://127.0.0.1:3100");
    for (let i = 0; i < BRIEF_CIRCUIT_FAILURE_THRESHOLD - 1; i += 1) {
      breaker.recordFailure();
    }
    expect(breaker.isOpen()).toBe(false);

    vi.spyOn(client, "postWorkspaceBrief").mockResolvedValue({
      ok: false,
      reason: "http_error",
      status: 409,
      message: "AI HTTP 409",
      attempts: 1,
      latencyMs: 5,
    });

    await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(breaker.isOpen()).toBe(false);
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);
  });

  it("maps invalid private schema responses to ai_invalid_response", async () => {
    vi.spyOn(client, "postWorkspaceBrief").mockResolvedValue({
      ok: true,
      response: { invalid: true },
      attempts: 1,
      latencyMs: 5,
    });

    const result = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe("ai_invalid_response");
  });

  it("maps integrity failures to ai_invalid_response", async () => {
    vi.spyOn(client, "postWorkspaceBrief").mockImplementation(async (snap) => ({
      ok: true,
      response: {
        ...validAiResponse,
        requestId: "00000000-0000-4000-8000-000000000099",
        projects: validAiResponse.projects.map((p) => ({
          ...p,
          generatedThrough: snap.projects[0]!.window.until,
        })),
      },
      attempts: 1,
      latencyMs: 5,
    }));

    const result = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe("ai_invalid_response");
  });

  it("returns HTTP 422 for snapshot_too_large", async () => {
    vi.spyOn(snapshot, "buildWorkspaceBriefSnapshot").mockResolvedValue({
      ok: false,
      code: "snapshot_too_large",
      truncationSteps: ["drop_project"],
      droppedProjectIds: [DROPPED_PROJECT_ID],
      byteLength: 300_000,
    });

    const result = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.httpStatus).toBe(422);
    expect(result.code).toBe("snapshot_too_large");
  });

  it("returns HTTP 500 for invalid_snapshot", async () => {
    vi.spyOn(snapshot, "buildWorkspaceBriefSnapshot").mockResolvedValue({
      ok: false,
      code: "invalid_snapshot",
      error: "bad snapshot",
    });

    const result = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("error");
    if (result.status !== "error") return;
    expect(result.httpStatus).toBe(500);
    expect(result.code).toBe("invalid_snapshot");
  });

  it("allows only one private-service call during half-open recovery", async () => {
    vi.useFakeTimers();
    resetBriefCircuitBreakers();

    const breaker = getBriefCircuitBreaker("http://127.0.0.1:3100");
    breaker.recordFailure({ immediateOpen: true });
    expect(breaker.getState()).toBe("open");

    vi.advanceTimersByTime(31_000);
    expect(breaker.getState()).toBe("half_open");

    let inFlight = 0;
    let maxConcurrent = 0;
    const postSpy = vi.spyOn(client, "postWorkspaceBrief").mockImplementation(async (snap) => {
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      await vi.advanceTimersByTimeAsync(25);
      inFlight -= 1;
      return {
        ok: true,
        response: {
          ...validAiResponse,
          requestId: snap.requestId,
        },
        attempts: 1,
        latencyMs: 25,
      };
    });

    const [first, second, third] = await Promise.all([
      getWorkspaceBrief(serviceDeps(cache, servedMeta), {
        userId: USER_ID,
        organizationId: ORG_ID,
      }),
      getWorkspaceBrief(serviceDeps(cache, servedMeta), {
        userId: USER_ID,
        organizationId: ORG_ID,
      }),
      getWorkspaceBrief(serviceDeps(cache, servedMeta), {
        userId: USER_ID,
        organizationId: ORG_ID,
      }),
    ]);

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(maxConcurrent).toBe(1);
    expect([first, second, third].filter((result) => result.status === "ok")).toHaveLength(1);
    expect(
      [first, second, third].filter(
        (result) => result.status === "unavailable" && result.reason === "circuit_open"
      )
    ).toHaveLength(2);

    vi.useRealTimers();
  });

  it("closes circuit after successful half-open probe when post-AI work throws", async () => {
    vi.useFakeTimers();
    resetBriefCircuitBreakers();

    const breaker = getBriefCircuitBreaker("http://127.0.0.1:3100");
    breaker.recordFailure({ immediateOpen: true });
    vi.advanceTimersByTime(31_000);
    expect(breaker.getState()).toBe("half_open");

    vi.spyOn(client, "postWorkspaceBrief").mockImplementation(async (snap) => ({
      ok: true,
      response: {
        ...validAiResponse,
        requestId: snap.requestId,
      },
      attempts: 1,
      latencyMs: 5,
    }));
    vi.spyOn(servedMeta, "store").mockImplementation(() => {
      throw new Error("served meta store failed");
    });

    const result = await getWorkspaceBrief(serviceDeps(cache, servedMeta), {
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result.status).toBe("error");
    expect(breaker.getState()).toBe("closed");

    vi.useRealTimers();
  });

  it("returns ai_misconfigured fallback for a missing secret without served-meta", async () => {
    const result = await getWorkspaceBrief(
      serviceDeps(cache, servedMeta, {
        TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
      }),
      { userId: USER_ID, organizationId: ORG_ID }
    );

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.httpStatus).toBe(200);
    expect(result.reason).toBe("ai_misconfigured");
    expect(result.fallback.schemaVersion).toBe("2026-07-brief-fallback-v1");
    expect(servedMeta.listForUserOrg(USER_ID, ORG_ID)).toHaveLength(0);
    expect(getBriefCircuitBreaker("http://127.0.0.1:3100").getState()).toBe("open");
  });

  it("returns ai_misconfigured fallback for invalid base64 secrets", async () => {
    const result = await getWorkspaceBrief(
      serviceDeps(cache, servedMeta, {
        TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
        TELEMETRY_AI_BRIEF_SECRET: "%%%invalid%%%",
      }),
      { userId: USER_ID, organizationId: ORG_ID }
    );

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe("ai_misconfigured");
    expect(servedMeta.listForUserOrg(USER_ID, ORG_ID)).toHaveLength(0);
  });

  it("returns ai_misconfigured fallback for short decoded secrets", async () => {
    const result = await getWorkspaceBrief(
      serviceDeps(cache, servedMeta, {
        TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
        TELEMETRY_AI_BRIEF_SECRET: Buffer.alloc(8).toString("base64"),
      }),
      { userId: USER_ID, organizationId: ORG_ID }
    );

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") return;
    expect(result.reason).toBe("ai_misconfigured");
    expect(servedMeta.listForUserOrg(USER_ID, ORG_ID)).toHaveLength(0);
  });

  it("does not log the configured secret when misconfigured", async () => {
    const secret = "short-secret-value";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await getWorkspaceBrief(
      serviceDeps(cache, servedMeta, {
        TELEMETRY_AI_BRIEF_URL: "http://127.0.0.1:3100",
        TELEMETRY_AI_BRIEF_SECRET: secret,
      }),
      { userId: USER_ID, organizationId: ORG_ID }
    );

    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).not.toContain(secret);
    errorSpy.mockRestore();
  });
});
