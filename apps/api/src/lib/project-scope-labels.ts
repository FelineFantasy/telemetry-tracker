import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

/** Distinct SDK app labels across Event, ErrorGroup, and Session (one UNION scan). */
export async function distinctAppsForProject(
  prisma: PrismaClient,
  projectId: string
): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ app: string }[]>(Prisma.sql`
    SELECT DISTINCT app FROM (
      SELECT app FROM "Event" WHERE project_id = ${projectId}
      UNION
      SELECT app FROM "ErrorGroup" WHERE project_id = ${projectId}
      UNION
      SELECT app FROM "Session" WHERE project_id = ${projectId}
    ) t
    ORDER BY app ASC
  `);
  return rows.map((row) => row.app);
}

/** Distinct non-empty environments, optionally filtered by app (one UNION scan). */
export async function distinctEnvironmentsForProject(
  prisma: PrismaClient,
  projectId: string,
  app?: string
): Promise<string[]> {
  const appClause = app ? Prisma.sql`AND app = ${app}` : Prisma.empty;
  const rows = await prisma.$queryRaw<{ environment: string }[]>(Prisma.sql`
    SELECT DISTINCT environment FROM (
      SELECT environment FROM "Event"
        WHERE project_id = ${projectId}
          AND environment IS NOT NULL
          AND TRIM(environment) <> ''
          ${appClause}
      UNION
      SELECT environment FROM "ErrorGroup"
        WHERE project_id = ${projectId}
          AND environment IS NOT NULL
          AND TRIM(environment) <> ''
          ${appClause}
    ) t
    ORDER BY environment ASC
  `);
  return rows.map((row) => row.environment);
}
