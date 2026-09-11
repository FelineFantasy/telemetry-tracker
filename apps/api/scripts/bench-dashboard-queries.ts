/**
 * Seed ~25k events in 24h plus comparable older history, then time dashboard
 * summary queries. Requires DATABASE_URL and applied migrations.
 *
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/telemetry \
 *     pnpm --filter api exec tsx scripts/bench-dashboard-queries.ts
 */
import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  fetchReleasesPageSummary,
  resolveReleasesSummaryWindow,
} from "../src/lib/releases-page-summary.js";
import {
  fetchSessionsPageSummary,
  resolveSessionsSummaryWindow,
} from "../src/lib/sessions-page-summary.js";
import {
  getOverviewActiveUsersPair,
  getOverviewErrorCountsPair,
  getOverviewEventWindowStats,
  getOverviewSessionsPair,
} from "../src/lib/overview-stats.js";
import { fetchOverviewRequestMetrics } from "../src/lib/overview-kpi.js";
import { listSessionsEnriched } from "../src/lib/sessions-list-query.js";

const prisma = new PrismaClient();

const WINDOW_EVENTS = 25_000;
const HISTORY_EVENTS = 25_000;
const SESSION_COUNT = 2_500;

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  console.log(`${label.padEnd(42)} ${ms.toFixed(1)} ms`);
  return result;
}

async function main(): Promise<void> {
  const until = new Date();
  const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
  const previousUntil = since;
  const previousSince = new Date(since.getTime() - 24 * 60 * 60 * 1000);

  const org = await prisma.organization.create({
    data: {
      name: `Bench org ${randomUUID()}`,
      projects: { create: { name: "Bench project", slug: `bench-${randomUUID().slice(0, 8)}` } },
    },
    include: { projects: true },
  });
  const projectId = org.projects[0]!.id;
  console.log(`Seeded project ${projectId}`);

  try {
    const sessions = Array.from({ length: SESSION_COUNT }, (_, i) => {
      const inWindow = i < SESSION_COUNT / 2;
      const started = inWindow
        ? new Date(since.getTime() + (i % 1_000) * 60_000)
        : new Date(since.getTime() - (7 + (i % 30)) * 24 * 60 * 60 * 1000);
      return {
        project_id: projectId,
        session_id: `sess-${i}`,
        app: "web",
        platform: "web",
        environment: "production",
        release: i % 3 === 0 ? "1.0.0" : "2.0.0",
        user_id: `user-${i % 400}`,
        anonymous_id: `anon-${i % 800}`,
        started_at: started,
        ended_at: new Date(started.getTime() + 30_000),
      };
    });
    for (let i = 0; i < sessions.length; i += 500) {
      await prisma.session.createMany({ data: sessions.slice(i, i + 500) });
    }

    const events: Array<{
      project_id: string;
      app: string;
      platform: string;
      environment: string;
      release: string;
      name: string;
      session_id: string;
      user_id: string;
      created_at: Date;
    }> = [];
    const pushEvent = (
      created_at: Date,
      name: string,
      sessionIndex: number,
      release: string
    ) => {
      events.push({
        project_id: projectId,
        app: "web",
        platform: "web",
        environment: "production",
        release,
        name,
        session_id: `sess-${sessionIndex}`,
        user_id: `user-${sessionIndex % 400}`,
        created_at,
      });
    };

    for (let i = 0; i < WINDOW_EVENTS; i++) {
      const created = new Date(since.getTime() + (i % 86_400) * 1000);
      const name = i % 20 === 0 ? "$request" : i % 7 === 0 ? "page_view" : "click";
      pushEvent(created, name, i % (SESSION_COUNT / 2), i % 3 === 0 ? "1.0.0" : "2.0.0");
    }
    for (let i = 0; i < HISTORY_EVENTS; i++) {
      const created = new Date(since.getTime() - (2 + (i % 40)) * 24 * 60 * 60 * 1000);
      pushEvent(created, "legacy", (SESSION_COUNT / 2) + (i % (SESSION_COUNT / 2)), "1.0.0");
    }

    for (let i = 0; i < events.length; i += 1_000) {
      await prisma.event.createMany({ data: events.slice(i, i + 1_000) });
    }

    const group = await prisma.errorGroup.create({
      data: {
        project_id: projectId,
        fingerprint: `bench-${randomUUID()}`,
        message: "bench error",
        app: "web",
        environment: "production",
        release: "2.0.0",
      },
    });
    const occurrences = Array.from({ length: 500 }, (_, i) => ({
      error_group_id: group.id,
      release: "2.0.0",
      platform: "web",
      environment: "production",
      session_id: `sess-${i % 200}`,
      created_at: new Date(since.getTime() + i * 1_000),
    }));
    await prisma.errorOccurrence.createMany({ data: occurrences });

    await prisma.$executeRawUnsafe("ANALYZE \"Event\"");
    await prisma.$executeRawUnsafe("ANALYZE \"Session\"");
    await prisma.$executeRawUnsafe("ANALYZE \"ErrorOccurrence\"");

    const filter = { range: { gte: since, lte: until } };
    const releasesWindow = resolveReleasesSummaryWindow(filter.range, until);
    const sessionsWindow = resolveSessionsSummaryWindow(filter.range, until);
    const scope = {
      projectId,
      since,
      until,
      app: "web",
      environment: "production",
    };

    console.log("\nTimings (24h window, ~25k window events + 25k older):");
    await timed("GET /api/releases/summary", () =>
      fetchReleasesPageSummary(prisma, filter, projectId, releasesWindow)
    );
    await timed("GET /api/sessions/summary", () =>
      fetchSessionsPageSummary(prisma, filter, projectId, sessionsWindow)
    );
    await timed("overview event window stats", () =>
      getOverviewEventWindowStats(prisma, {
        projectId,
        since,
        until,
        previousSince,
        previousUntil,
      })
    );
    await timed("overview error counts", () =>
      getOverviewErrorCountsPair(prisma, {
        projectId,
        since,
        until,
        previousSince,
        previousUntil,
      })
    );
    await timed("overview sessions pair", () =>
      getOverviewSessionsPair(prisma, scope, previousSince, previousUntil)
    );
    await timed("overview active users", () =>
      getOverviewActiveUsersPair(prisma, {
        projectId,
        since,
        until,
        previousSince,
        previousUntil,
      })
    );
    await timed("overview request metrics", () =>
      fetchOverviewRequestMetrics(prisma, scope, previousSince, previousUntil, "hour")
    );
    await timed("GET /api/sessions list (started_at)", () =>
      listSessionsEnriched(prisma, filter, projectId, { gte: since, lte: until }, "started_at", "desc", 0, 25)
    );

    console.log("\nInserting 100k older events to check 24h queries vs all-time volume...");
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO "Event" (
        id, project_id, app, name, created_at, release, environment, platform
      )
      SELECT
        gen_random_uuid()::text,
        ${projectId},
        'web',
        'legacy_hist',
        ${since} - ((2 + (g % 60)) * INTERVAL '1 day'),
        '0.9.0',
        'production',
        'web'
      FROM generate_series(1, 100000) g
    `);
    await prisma.$executeRawUnsafe('ANALYZE "Event"');
    console.log("Timings after +100k historical events (~125k events all-time):");
    await timed("releases/summary (all-time first/last seen)", () =>
      fetchReleasesPageSummary(prisma, filter, projectId, releasesWindow)
    );
    await timed("sessions/summary (24h window)", () =>
      fetchSessionsPageSummary(prisma, filter, projectId, sessionsWindow)
    );
    await timed("overview event window stats (24h)", () =>
      getOverviewEventWindowStats(prisma, {
        projectId,
        since,
        until,
        previousSince,
        previousUntil,
      })
    );
    await timed("sessions list (started_at)", () =>
      listSessionsEnriched(prisma, filter, projectId, { gte: since, lte: until }, "started_at", "desc", 0, 25)
    );

    const plans = await prisma.$queryRaw<Array<{ "QUERY PLAN": string }>>(Prisma.sql`
      EXPLAIN (ANALYZE, BUFFERS)
      SELECT COUNT(*) FILTER (
        WHERE e."created_at" >= ${since} AND e."created_at" <= ${until}
      )
      FROM "Event" e
      WHERE e."project_id" = ${projectId}
        AND e."created_at" >= ${previousSince}
        AND e."created_at" <= ${until}
    `);
    console.log("\nEXPLAIN event window count:\n", plans.map((p) => p["QUERY PLAN"]).join("\n"));
  } finally {
    await prisma.organization.delete({ where: { id: org.id } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
