import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db.js";
import {
  fetchReleasesPageSummary,
  resolveReleasesSummaryWindow,
} from "./releases-page-summary.js";
import {
  fetchSessionsPageSummary,
  resolveSessionsSummaryWindow,
} from "./sessions-page-summary.js";
import { getOverviewEventWindowStats } from "./overview-stats.js";
import { listSessionsEnriched } from "./sessions-list-query.js";

const runDbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "true";

describe.skipIf(!runDbIntegration)("dashboard summary query semantics (integration)", () => {
  let organizationId: string | undefined;
  let projectId: string | undefined;

  const until = new Date("2026-06-28T12:00:00.000Z");
  const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
  const previousUntil = since;
  const previousSince = new Date(since.getTime() - 24 * 60 * 60 * 1000);
  const oldAt = new Date("2026-05-01T12:00:00.000Z");
  const windowAt = new Date("2026-06-28T06:00:00.000Z");

  beforeAll(async () => {
    const suffix = randomBytes(8).toString("hex");
    const org = await prisma.organization.create({
      data: {
        name: `Query perf org ${suffix}`,
        projects: {
          create: {
            name: "Query perf project",
            slug: `query-perf-${suffix}`,
          },
        },
      },
      include: { projects: true },
    });
    organizationId = org.id;
    projectId = org.projects[0]!.id;

    await prisma.session.createMany({
      data: [
        {
          project_id: projectId,
          session_id: "sess-old-user",
          app: "web",
          platform: "web",
          environment: "production",
          release: "1.0.0",
          user_id: "user-returning",
          anonymous_id: "anon-linked",
          started_at: oldAt,
          ended_at: new Date(oldAt.getTime() + 60_000),
        },
        {
          project_id: projectId,
          session_id: "sess-window-returning",
          app: "web",
          platform: "web",
          environment: "production",
          release: "2.0.0",
          user_id: "user-returning",
          started_at: windowAt,
          ended_at: new Date(windowAt.getTime() + 120_000),
        },
        {
          project_id: projectId,
          session_id: "sess-window-new",
          app: "web",
          platform: "web",
          environment: "production",
          release: "2.0.0",
          user_id: "user-new",
          started_at: new Date(windowAt.getTime() + 1_000),
          ended_at: new Date(windowAt.getTime() + 91_000),
        },
        {
          project_id: projectId,
          session_id: "sess-window-anon",
          app: "web",
          platform: "web",
          environment: "production",
          release: "2.0.0",
          anonymous_id: "anon-linked",
          started_at: new Date(windowAt.getTime() + 2_000),
          ended_at: new Date(windowAt.getTime() + 7_000),
        },
      ],
    });

    await prisma.event.createMany({
      data: [
        {
          project_id: projectId,
          app: "web",
          platform: "web",
          environment: "production",
          release: "1.0.0",
          name: "legacy_page",
          session_id: "sess-old-user",
          user_id: "user-returning",
          created_at: oldAt,
        },
        {
          project_id: projectId,
          app: "web",
          platform: "web",
          environment: "production",
          release: "2.0.0",
          name: "page_view",
          session_id: "sess-window-returning",
          user_id: "user-returning",
          created_at: windowAt,
        },
        {
          project_id: projectId,
          app: "web",
          platform: "web",
          environment: "production",
          release: "2.0.0",
          name: "page_view",
          session_id: "sess-window-new",
          user_id: "user-new",
          created_at: windowAt,
        },
        {
          project_id: projectId,
          app: "web",
          platform: "web",
          environment: "production",
          release: "2.0.0",
          name: "click",
          session_id: "sess-window-anon",
          anonymous_id: "anon-linked",
          created_at: windowAt,
        },
        {
          project_id: projectId,
          app: "web",
          platform: "web",
          environment: "production",
          release: "2.0.0",
          name: "$request",
          session_id: "sess-window-returning",
          properties: { duration_ms: 120 },
          created_at: windowAt,
        },
      ],
    });

    const group = await prisma.errorGroup.create({
      data: {
        project_id: projectId,
        fingerprint: `fp-${suffix}`,
        message: "boom",
        app: "web",
        environment: "production",
        release: "2.0.0",
        platform: "web",
        last_seen: windowAt,
        first_seen: windowAt,
      },
    });
    await prisma.errorOccurrence.create({
      data: {
        error_group_id: group.id,
        release: "2.0.0",
        platform: "web",
        environment: "production",
        session_id: "sess-window-returning",
        user_id: "user-returning",
        created_at: windowAt,
      },
    });
  });

  afterAll(async () => {
    if (organizationId) {
      await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
    }
  });

  it("keeps historical-only releases and window KPI counts", async () => {
    const filter = { range: { gte: since, lte: until } };
    const window = resolveReleasesSummaryWindow(filter.range, until);
    const summary = await fetchReleasesPageSummary(prisma, filter, projectId!, window);

    const v1 = summary.items.find((r) => r.releaseKey === "1.0.0");
    const v2 = summary.items.find((r) => r.releaseKey === "2.0.0");
    expect(v1).toBeDefined();
    expect(v1?.events).toBe(0);
    expect(v1?.sessions).toBe(0);
    expect(v1?.firstSeenAt).toBe(oldAt.toISOString());
    expect(v2).toBeDefined();
    expect(v2?.events).toBe(4);
    expect(v2?.sessions).toBe(3);
    expect(v2?.errors).toBe(1);
    expect(summary.totals.events).toBe(4);
    expect(summary.totals.sessions).toBe(3);
    expect(summary.totals.errors).toBe(1);
  });

  it("counts linked anonymous window sessions as returning users", async () => {
    const filter = { range: { gte: since, lte: until } };
    const window = resolveSessionsSummaryWindow(filter.range, until);
    const summary = await fetchSessionsPageSummary(prisma, filter, projectId!, window);

    expect(summary.totalSessions).toBe(3);
    expect(summary.distinctUsers).toBe(2);
    expect(summary.userCohorts.returningUsers).toBe(1);
    expect(summary.userCohorts.newUsers).toBe(1);
    expect(summary.crashFreeRatePct).toBeCloseTo((2 / 3) * 100, 5);
  });

  it("bounds event window stats to the requested range", async () => {
    const stats = await getOverviewEventWindowStats(prisma, {
      projectId: projectId!,
      since,
      until,
      previousSince,
      previousUntil,
    });
    expect(stats.eventsCount).toBe(4);
    expect(stats.eventsPrevious).toBe(0);
    expect(stats.distinctEventNames).toBe(3);
  });

  it("pages session list rows without changing default sort order", async () => {
    const { total, rows } = await listSessionsEnriched(
      prisma,
      { range: { gte: since, lte: until } },
      projectId!,
      { gte: since, lte: until },
      "started_at",
      "desc",
      0,
      10
    );
    expect(total).toBe(3);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.session_id).toBe("sess-window-anon");
  });
});
