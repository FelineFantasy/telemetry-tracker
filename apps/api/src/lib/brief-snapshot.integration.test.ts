import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db.js";
import { buildWorkspaceBriefSnapshot } from "./brief-snapshot.js";
import { BRIEF_MAX_SNAPSHOT_BYTES } from "./brief-constants.js";

const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";

const REQUEST_UNTIL = new Date("2026-07-14T12:00:00.000Z");
const WINDOW_SINCE = new Date("2026-07-07T12:00:00.000Z");
const WINDOW_PREVIOUS_SINCE = new Date("2026-06-30T12:00:00.000Z");
const MID_CURRENT = new Date("2026-07-10T10:00:00.000Z");
const PREVIOUS_WINDOW = new Date("2026-07-03T10:00:00.000Z");
const UNTIL_BOUNDARY = new Date("2026-07-14T12:00:00.000Z");

describe.skipIf(!runDbIntegration)(
  "buildWorkspaceBriefSnapshot (integration)",
  { hookTimeout: 60_000, timeout: 60_000 },
  () => {
  let organizationId: string;
  let projectId: string;
  let userId: string;
  let errorGroupNewId: string;
  let errorGroupOldHighId: string;
  let errorGroupOldLowId: string;
  const suffix = randomBytes(6).toString("hex");

  beforeAll(async () => {
    await prisma.$connect();
    userId = "a0000000-0000-4000-8000-000000000099";
    const org = await prisma.organization.create({
      data: {
        name: `Brief snapshot org ${suffix}`,
        projects: {
          create: {
            name: "Brief snapshot project",
            slug: `brief-snapshot-${suffix}`,
          },
        },
      },
      include: { projects: true },
    });
    organizationId = org.id;
    projectId = org.projects[0]!.id;

    await prisma.session.create({
      data: {
        project_id: projectId,
        session_id: `brief-session-${suffix}`,
        app: "web",
        device_browser: "Safari",
        device_os: "macOS",
        started_at: MID_CURRENT,
        ended_at: new Date("2026-07-10T10:05:00.000Z"),
      },
    });

    const egNew = await prisma.errorGroup.create({
      data: {
        project_id: projectId,
        fingerprint: `brief-new-${suffix}`,
        message: "Failed for user@example.com in checkout",
        app: "web",
        environment: "production",
        release: "2.0.0",
        first_seen: MID_CURRENT,
        last_seen: MID_CURRENT,
      },
    });
    errorGroupNewId = egNew.id;

    const egOldHigh = await prisma.errorGroup.create({
      data: {
        project_id: projectId,
        fingerprint: `brief-old-high-${suffix}`,
        message: "Old high-volume error",
        app: "web",
        environment: "production",
        release: "2.0.0",
        first_seen: new Date("2026-05-01T00:00:00.000Z"),
        last_seen: MID_CURRENT,
      },
    });
    errorGroupOldHighId = egOldHigh.id;

    const egOldLow = await prisma.errorGroup.create({
      data: {
        project_id: projectId,
        fingerprint: `brief-old-low-${suffix}`,
        message: "Old steady error",
        app: "web",
        environment: "staging",
        release: "1.0.0",
        first_seen: new Date("2026-05-01T00:00:00.000Z"),
        last_seen: MID_CURRENT,
      },
    });
    errorGroupOldLowId = egOldLow.id;

    await prisma.errorOccurrence.createMany({
      data: [
        {
          error_group_id: errorGroupNewId,
          created_at: MID_CURRENT,
          release: "2.0.0",
          session_id: `brief-session-${suffix}`,
          user_id: "user-new",
        },
        {
          error_group_id: errorGroupOldHighId,
          created_at: WINDOW_SINCE,
          release: "2.0.0",
          session_id: `brief-session-${suffix}`,
          user_id: "user-a",
        },
        {
          error_group_id: errorGroupOldHighId,
          created_at: MID_CURRENT,
          release: "2.0.0",
          session_id: `brief-session-${suffix}`,
          user_id: "user-a",
        },
        {
          error_group_id: errorGroupOldHighId,
          created_at: MID_CURRENT,
          release: "2.0.0",
          user_id: "user-b",
        },
        {
          error_group_id: errorGroupOldHighId,
          created_at: MID_CURRENT,
          release: "2.0.0",
          anonymous_id: "anon-c",
        },
        {
          error_group_id: errorGroupOldHighId,
          created_at: MID_CURRENT,
          release: "2.0.0",
          anonymous_id: "anon-c",
        },
        {
          error_group_id: errorGroupOldHighId,
          created_at: UNTIL_BOUNDARY,
          release: "2.0.0",
          user_id: "user-boundary",
        },
        {
          error_group_id: errorGroupOldHighId,
          created_at: PREVIOUS_WINDOW,
          release: "2.0.0",
          user_id: "user-prev",
        },
        {
          error_group_id: errorGroupOldLowId,
          created_at: MID_CURRENT,
          release: "1.0.0",
          user_id: "user-low-1",
        },
        {
          error_group_id: errorGroupOldLowId,
          created_at: MID_CURRENT,
          release: "1.0.0",
          user_id: "user-low-2",
        },
        {
          error_group_id: errorGroupOldLowId,
          created_at: PREVIOUS_WINDOW,
          release: "1.0.0",
          user_id: "user-low-prev-1",
        },
        {
          error_group_id: errorGroupOldLowId,
          created_at: PREVIOUS_WINDOW,
          release: "1.0.0",
          user_id: "user-low-prev-2",
        },
      ],
    });

    await prisma.event.createMany({
      data: [
        {
          project_id: projectId,
          app: "web",
          name: "page_view",
          environment: "production",
          release: "2.0.0",
          created_at: WINDOW_SINCE,
          user_id: "event-user-a",
        },
        {
          project_id: projectId,
          app: "web",
          name: "page_view",
          environment: "production",
          release: "2.0.0",
          created_at: MID_CURRENT,
          anonymous_id: "event-anon-b",
        },
        {
          project_id: projectId,
          app: "web",
          name: "page_view",
          environment: "production",
          release: "2.0.0",
          created_at: MID_CURRENT,
          anonymous_id: "event-anon-c",
        },
        {
          project_id: projectId,
          app: "web",
          name: "page_view",
          environment: "staging",
          release: "1.0.0",
          created_at: MID_CURRENT,
        },
        {
          project_id: projectId,
          app: "web",
          name: "page_view",
          environment: "production",
          release: "1.0.0",
          created_at: MID_CURRENT,
        },
        {
          project_id: projectId,
          app: "web",
          name: "page_view",
          environment: "production",
          release: "2.0.0",
          created_at: UNTIL_BOUNDARY,
        },
        {
          project_id: projectId,
          app: "web",
          name: "page_view",
          environment: "production",
          release: "1.0.0",
          created_at: PREVIOUS_WINDOW,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  });

  function buildInput(requestId: string) {
    return {
      organizationId,
      requestId,
      requestUntil: REQUEST_UNTIL,
      userId,
      projects: [
        {
          id: projectId,
          name: "Brief snapshot project",
          slug: `brief-snapshot-${suffix}`,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    };
  }

  async function buildSnapshot(requestId: string) {
    await prisma.$connect();
    return buildWorkspaceBriefSnapshot(prisma, buildInput(requestId));
  }

  it(
    "assembles batched factual data with half-open windows and sanitization",
    async () => {
    const result = await buildSnapshot("b0000000-0000-4000-8000-000000000003");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const project = result.snapshot.projects[0]!;

    expect(project.window.since).toBe(WINDOW_SINCE.toISOString());
    expect(project.window.until).toBe(REQUEST_UNTIL.toISOString());
    expect(project.window.previousSince).toBe(WINDOW_PREVIOUS_SINCE.toISOString());
    expect(project.window.previousUntil).toBe(WINDOW_SINCE.toISOString());

    expect(project.kpis.errors).toEqual({ count: 8, previous: 3 });
    expect(project.kpis.events).toEqual({ count: 5, previous: 1 });
    expect(project.kpis.activeUsers.count).toBeGreaterThanOrEqual(2);

    const firstSeenIds = project.errorGroups.firstSeenInWindow.map((row) => row.id);
    expect(firstSeenIds).toEqual([errorGroupNewId]);
    expect(firstSeenIds).not.toContain(errorGroupOldHighId);
    expect(firstSeenIds).not.toContain(errorGroupOldLowId);

    const byOccurrenceIds = project.errorGroups.byOccurrenceCount.map((row) => row.id);
    expect(byOccurrenceIds[0]).toBe(errorGroupOldHighId);
    expect(byOccurrenceIds[1]).toBe(errorGroupOldLowId);
    expect(byOccurrenceIds[2]).toBe(errorGroupNewId);
    expect(byOccurrenceIds).toContain(errorGroupOldHighId);

    const byDeltaIds = project.errorGroups.byAbsoluteDelta.map((row) => row.id);
    expect(byDeltaIds[0]).toBe(errorGroupOldHighId);
    expect(byDeltaIds[1]).toBe(errorGroupNewId);

    const oldHigh = project.errorGroups.byOccurrenceCount.find(
      (row) => row.id === errorGroupOldHighId
    )!;
    expect(oldHigh.occurrences).toEqual({ count: 5, previous: 1 });
    expect(oldHigh.affectedUsers.count).toBe(3);
    expect(oldHigh.topBrowsers).toEqual([{ browser: "Safari", count: 2 }]);
    expect(oldHigh.topOs).toEqual([{ os: "macOS", count: 2 }]);

    const sanitizedNew = project.errorGroups.firstSeenInWindow.find(
      (row) => row.id === errorGroupNewId
    )!;
    expect(sanitizedNew.message).toBe("Failed for [email] in checkout");

    expect(project.releases?.byErrorOccurrences[0]).toEqual({
      release: "2.0.0",
      errorOccurrences: 6,
      eventRows: 3,
    });
    expect(project.releases?.byErrorOccurrences[1]).toEqual({
      release: "1.0.0",
      errorOccurrences: 2,
      eventRows: 2,
    });

    expect(project.environments?.byEventRows).toEqual([
      { environment: "production", count: 4 },
      { environment: "staging", count: 1 },
    ]);

    expect(result.meta.byteLength).toBeLessThanOrEqual(BRIEF_MAX_SNAPSHOT_BYTES);
    },
    30_000
  );

  it(
    "returns stable contentHash across equivalent builds with different requestId",
    async () => {
    const first = await buildSnapshot("d0000000-0000-4000-8000-000000000005");
    const second = await buildSnapshot("e0000000-0000-4000-8000-000000000006");

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.contentHash).toBe(second.contentHash);
    expect(first.snapshotHash).toBe(second.snapshotHash);
    expect(first.snapshot.requestId).not.toBe(second.snapshot.requestId);
    },
    60_000
  );
  }
);
