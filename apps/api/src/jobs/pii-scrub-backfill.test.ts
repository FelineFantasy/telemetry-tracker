import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatPiiScrubBackfillReport,
  parsePiiScrubBackfillArgs,
  runPiiScrubBackfill,
} from "./pii-scrub-backfill.js";

describe("parsePiiScrubBackfillArgs", () => {
  it("requires project or org scope", () => {
    const parsed = parsePiiScrubBackfillArgs(["--dry-run"]);
    expect(parsed.error).toMatch(/exactly one/);
  });

  it("rejects both project-id and org-id", () => {
    const parsed = parsePiiScrubBackfillArgs([
      "--project-id",
      "p1",
      "--org-id",
      "o1",
    ]);
    expect(parsed.error).toMatch(/not both/);
  });

  it("parses flags", () => {
    expect(
      parsePiiScrubBackfillArgs([
        "--project-id",
        "p1",
        "--dry-run",
        "--include-sessions",
        "--scrub-fingerprints",
        "--fail-fast",
        "--limit",
        "10",
        "--batch-size",
        "50",
      ]).options
    ).toEqual({
      dryRun: true,
      projectId: "p1",
      orgId: undefined,
      limit: 10,
      batchSize: 50,
      includeSessions: true,
      scrubFingerprints: true,
      failFast: true,
    });
  });
});

describe("formatPiiScrubBackfillReport", () => {
  it("renders scanned / modified / skipped / failures sections", () => {
    const text = formatPiiScrubBackfillReport({
      projectsProcessed: 1,
      dryRun: true,
      scanned: { events: 15000, occurrences: 3500, groups: 180, sessions: 42 },
      modified: {
        events: 812,
        occurrences: 114,
        groups: 12,
        sessions: 6,
        fingerprints: 0,
      },
      skipped: { alreadyScrubbed: 917, fingerprintConflicts: 2 },
      failures: { databaseErrors: 0 },
    });
    expect(text).toContain("Events: 15000");
    expect(text).toContain("Modified:");
    expect(text).toContain("Already scrubbed: 917");
    expect(text).toContain("Fingerprint conflicts: 2");
    expect(text).toContain("Database errors: 0");
    expect(text).toContain("Completed successfully.");
  });
});

describe("runPiiScrubBackfill", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("refuses to run when ingest scrubbing is disabled", async () => {
    vi.stubEnv("TELEMETRY_INGEST_PII_SCRUB", "false");
    await expect(
      runPiiScrubBackfill({} as never, { projectId: "p1" })
    ).rejects.toThrow(/TELEMETRY_INGEST_PII_SCRUB/);
  });

  it("fails when --project-id matches no eligible project", async () => {
    const prisma = {
      project: { findMany: vi.fn(async () => []) },
    };
    await expect(
      runPiiScrubBackfill(prisma as never, { projectId: "missing" })
    ).rejects.toThrow(/No eligible project found for --project-id missing/);
  });

  it("fails when --project-id points at a deleted project", async () => {
    // Query filters deleted_at: null, so deleted projects are returned as empty.
    const prisma = {
      project: { findMany: vi.fn(async () => []) },
    };
    await expect(
      runPiiScrubBackfill(prisma as never, { projectId: "deleted-proj" })
    ).rejects.toThrow(/unknown or deleted/);
  });

  it("fails when --org-id matches no eligible projects", async () => {
    const prisma = {
      project: { findMany: vi.fn(async () => []) },
    };
    await expect(
      runPiiScrubBackfill(prisma as never, { orgId: "unknown-org" })
    ).rejects.toThrow(
      /No eligible projects found for --org-id unknown-org/
    );
  });

  it("fails when organization has no active projects", async () => {
    const prisma = {
      project: { findMany: vi.fn(async () => []) },
    };
    await expect(
      runPiiScrubBackfill(prisma as never, { orgId: "empty-org" })
    ).rejects.toThrow(/no active projects/);
  });

  it("rejects both projectId and orgId at runtime", async () => {
    await expect(
      runPiiScrubBackfill({} as never, { projectId: "p1", orgId: "o1" })
    ).rejects.toThrow(/not both/);
  });

  it("scrubs event properties and skips unchanged rows (dry-run)", async () => {
    const eventFindMany = vi
      .fn()
      .mockResolvedValueOnce([
        { id: "e1", properties: { email: "a@b.co", ok: 1 } },
        { id: "e2", properties: { ok: true } },
      ])
      .mockResolvedValueOnce([]);
    const eventUpdate = vi.fn();
    const prisma = {
      project: {
        findMany: vi.fn(async () => [
          { id: "p1", pii_scrub_settings: { denyKeys: [] } },
        ]),
      },
      event: { findMany: eventFindMany, update: eventUpdate },
      errorOccurrence: { findMany: vi.fn(async () => []) },
      errorGroup: { findMany: vi.fn(async () => []) },
      session: { findMany: vi.fn(async () => []) },
    };

    const result = await runPiiScrubBackfill(prisma as never, {
      projectId: "p1",
      dryRun: true,
      batchSize: 10,
    });

    expect(result.projectsProcessed).toBe(1);
    expect(result.scanned.events).toBe(2);
    expect(result.modified.events).toBe(1);
    expect(result.skipped.alreadyScrubbed).toBe(1);
    expect(eventUpdate).not.toHaveBeenCalled();
  });

  it("writes scrubbed event properties when not dry-run", async () => {
    const eventUpdate = vi.fn(async () => ({}));
    const prisma = {
      project: {
        findMany: vi.fn(async () => [
          { id: "p1", pii_scrub_settings: { denyKeys: ["nationalId"] } },
        ]),
      },
      event: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            { id: "e1", properties: { nationalId: "X", note: "hi" } },
          ])
          .mockResolvedValueOnce([]),
        update: eventUpdate,
      },
      errorOccurrence: { findMany: vi.fn(async () => []) },
      errorGroup: { findMany: vi.fn(async () => []) },
      session: { findMany: vi.fn(async () => []) },
    };

    await runPiiScrubBackfill(prisma as never, {
      projectId: "p1",
      dryRun: false,
      batchSize: 10,
    });

    expect(eventUpdate).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { properties: { nationalId: "[redacted]", note: "hi" } },
    });
  });

  it("scrubs occurrence stacks and group messages without touching fingerprints by default", async () => {
    const occUpdate = vi.fn(async () => ({}));
    const groupUpdate = vi.fn(async () => ({}));
    const prisma = {
      project: {
        findMany: vi.fn(async () => [
          { id: "p1", pii_scrub_settings: null },
        ]),
      },
      event: { findMany: vi.fn(async () => []) },
      errorOccurrence: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: "o1",
              stack: "Error: user@example.com\n  at x",
              context: { email: "a@b.co" },
            },
          ])
          .mockResolvedValueOnce([]),
        update: occUpdate,
      },
      errorGroup: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: "g1",
              message: "boom user@example.com",
              top_stack: "at f (a@b.co)",
              fingerprint: "raw user@example.com",
            },
          ])
          .mockResolvedValueOnce([]),
        update: groupUpdate,
      },
      session: { findMany: vi.fn(async () => []) },
    };

    const result = await runPiiScrubBackfill(prisma as never, {
      projectId: "p1",
      dryRun: false,
      batchSize: 10,
    });

    expect(occUpdate).toHaveBeenCalledWith({
      where: { id: "o1" },
      data: {
        stack: "Error: [email]\n  at x",
        context: { email: "[email]" },
      },
    });
    expect(groupUpdate).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: {
        message: "boom [email]",
        top_stack: "at f ([email])",
      },
    });
    expect(result.modified.fingerprints).toBe(0);
  });

  it("counts fingerprint unique conflicts and still scrubs display fields", async () => {
    const groupUpdate = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }))
      .mockResolvedValueOnce({});
    const prisma = {
      project: {
        findMany: vi.fn(async () => [{ id: "p1", pii_scrub_settings: null }]),
      },
      event: { findMany: vi.fn(async () => []) },
      errorOccurrence: { findMany: vi.fn(async () => []) },
      errorGroup: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              id: "g1",
              message: "boom user@example.com",
              top_stack: null,
              fingerprint: "raw user@example.com",
            },
          ])
          .mockResolvedValueOnce([]),
        update: groupUpdate,
      },
      session: { findMany: vi.fn(async () => []) },
    };

    const result = await runPiiScrubBackfill(prisma as never, {
      projectId: "p1",
      dryRun: false,
      scrubFingerprints: true,
      batchSize: 10,
    });

    expect(result.skipped.fingerprintConflicts).toBe(1);
    expect(result.modified.groups).toBe(1);
    expect(result.modified.fingerprints).toBe(0);
    expect(groupUpdate).toHaveBeenLastCalledWith({
      where: { id: "g1" },
      data: { message: "boom [email]" },
    });
  });

  it("continues after non-fatal database errors unless failFast", async () => {
    const eventUpdate = vi
      .fn()
      .mockRejectedValueOnce(new Error("db down"))
      .mockResolvedValueOnce({});
    const prisma = {
      project: {
        findMany: vi.fn(async () => [{ id: "p1", pii_scrub_settings: null }]),
      },
      event: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            { id: "e1", properties: { email: "a@b.co" } },
            { id: "e2", properties: { email: "c@d.co" } },
          ])
          .mockResolvedValueOnce([]),
        update: eventUpdate,
      },
      errorOccurrence: { findMany: vi.fn(async () => []) },
      errorGroup: { findMany: vi.fn(async () => []) },
      session: { findMany: vi.fn(async () => []) },
    };

    const result = await runPiiScrubBackfill(prisma as never, {
      projectId: "p1",
      dryRun: false,
      batchSize: 10,
    });

    expect(result.failures.databaseErrors).toBe(1);
    expect(result.modified.events).toBe(1);
    expect(eventUpdate).toHaveBeenCalledTimes(2);
  });

  it("scrubs session emails only with includeSessions and project flag", async () => {
    const sessionUpdate = vi.fn(async () => ({}));
    const prisma = {
      project: {
        findMany: vi.fn(async () => [
          {
            id: "p1",
            pii_scrub_settings: { scrubSessionUserEmail: true },
          },
        ]),
      },
      event: { findMany: vi.fn(async () => []) },
      errorOccurrence: { findMany: vi.fn(async () => []) },
      errorGroup: { findMany: vi.fn(async () => []) },
      session: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([{ id: "s1", user_email: "a@b.co" }])
          .mockResolvedValueOnce([]),
        update: sessionUpdate,
      },
    };

    await runPiiScrubBackfill(prisma as never, {
      projectId: "p1",
      dryRun: false,
      includeSessions: true,
      batchSize: 10,
    });

    expect(sessionUpdate).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { user_email: "[email]" },
    });
  });

  it("does not touch sessions without includeSessions", async () => {
    const sessionFindMany = vi.fn(async () => []);
    const prisma = {
      project: {
        findMany: vi.fn(async () => [
          {
            id: "p1",
            pii_scrub_settings: { scrubSessionUserEmail: true },
          },
        ]),
      },
      event: { findMany: vi.fn(async () => []) },
      errorOccurrence: { findMany: vi.fn(async () => []) },
      errorGroup: { findMany: vi.fn(async () => []) },
      session: { findMany: sessionFindMany },
    };

    await runPiiScrubBackfill(prisma as never, {
      projectId: "p1",
      dryRun: true,
      includeSessions: false,
    });

    expect(sessionFindMany).not.toHaveBeenCalled();
  });

  it("does not touch sessions when project flag is off even with includeSessions", async () => {
    const sessionFindMany = vi.fn(async () => []);
    const prisma = {
      project: {
        findMany: vi.fn(async () => [
          {
            id: "p1",
            pii_scrub_settings: { scrubSessionUserEmail: false },
          },
        ]),
      },
      event: { findMany: vi.fn(async () => []) },
      errorOccurrence: { findMany: vi.fn(async () => []) },
      errorGroup: { findMany: vi.fn(async () => []) },
      session: { findMany: sessionFindMany },
    };

    await runPiiScrubBackfill(prisma as never, {
      projectId: "p1",
      dryRun: true,
      includeSessions: true,
    });

    expect(sessionFindMany).not.toHaveBeenCalled();
  });
});
