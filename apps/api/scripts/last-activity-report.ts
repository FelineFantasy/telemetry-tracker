import { prisma } from "../src/lib/db.js";

async function main() {
  const projects = await prisma.project.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      name: true,
      slug: true,
      organization: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  console.log(`\nProjects in database: ${projects.length}\n`);

  for (const p of projects) {
    const [lastEvent, lastError, lastSession, counts] = await Promise.all([
      prisma.event.findFirst({
        where: { project_id: p.id },
        orderBy: { created_at: "desc" },
        select: { created_at: true, app: true, name: true },
      }),
      prisma.errorGroup.findFirst({
        where: { project_id: p.id },
        orderBy: { last_seen: "desc" },
        select: { last_seen: true, app: true, message: true },
      }),
      prisma.session.findFirst({
        where: { project_id: p.id },
        orderBy: { started_at: "desc" },
        select: { started_at: true, app: true },
      }),
      Promise.all([
        prisma.event.count({ where: { project_id: p.id } }),
        prisma.errorGroup.count({ where: { project_id: p.id } }),
        prisma.session.count({ where: { project_id: p.id } }),
      ]),
    ]);

    const apps = await prisma.$queryRaw<
      { app: string; last_activity: Date | null; row_count: number }[]
    >`
      SELECT app,
        MAX(latest) AS last_activity,
        SUM(n)::int AS row_count
      FROM (
        SELECT app, MAX(created_at) AS latest, COUNT(*)::int AS n
          FROM "Event" WHERE project_id = ${p.id} GROUP BY app
        UNION ALL
        SELECT app, MAX(last_seen) AS latest, COUNT(*)::int AS n
          FROM "ErrorGroup" WHERE project_id = ${p.id} GROUP BY app
        UNION ALL
        SELECT app, MAX(started_at) AS latest, COUNT(*)::int AS n
          FROM "Session" WHERE project_id = ${p.id} GROUP BY app
      ) t
      GROUP BY app
      ORDER BY last_activity DESC NULLS LAST
    `;

    const lastOverall = [
      lastEvent?.created_at,
      lastError?.last_seen,
      lastSession?.started_at,
    ]
      .filter(Boolean)
      .sort((a, b) => b!.getTime() - a!.getTime())[0];

    console.log(`=== ${p.organization.name} → ${p.name} ===`);
    console.log(`  Last activity (any type): ${lastOverall?.toISOString() ?? "(none)"}`);
    console.log(`  Totals: ${counts[0]} events | ${counts[1]} error groups | ${counts[2]} sessions`);
    console.log(
      `  Last event:  ${lastEvent ? `${lastEvent.created_at.toISOString()} (${lastEvent.app} / ${lastEvent.name})` : "(none)"}`
    );
    console.log(
      `  Last error:  ${lastError ? `${lastError.last_seen.toISOString()} (${lastError.app})` : "(none)"}`
    );
    console.log(
      `  Last session: ${lastSession ? `${lastSession.started_at.toISOString()} (${lastSession.app})` : "(none)"}`
    );
    console.log("  By app (SDK app label):");
    if (apps.length === 0) {
      console.log("    (none)");
    } else {
      for (const a of apps) {
        console.log(
          `    - ${a.app}: ${a.last_activity ? a.last_activity.toISOString() : "(none)"} (${a.row_count} rows)`
        );
      }
    }
    console.log("");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
