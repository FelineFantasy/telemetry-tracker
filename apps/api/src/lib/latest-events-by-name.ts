import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { buildEventWhereSql } from "./list-query-helpers.js";

export type LatestEventByNameRow = {
  id: string;
  name: string;
  app: string;
  platform: string | null;
  environment: string | null;
  release: string | null;
  created_at: Date;
};

/** Latest event row per name (one query instead of N findFirst calls). */
export async function fetchLatestEventsByName(
  prisma: PrismaClient,
  params: {
    projectId: string;
    since?: Date;
    until?: Date;
    app?: string;
    environment?: string;
    platform?: string;
    release?: string;
    propertiesContains?: string;
    names: string[];
  }
): Promise<Map<string, LatestEventByNameRow>> {
  const { names } = params;
  if (names.length === 0) return new Map();

  const whereSql = buildEventWhereSql({
    projectId: params.projectId,
    appId: params.app,
    environment: params.environment,
    platform: params.platform,
    release: params.release,
    propertiesContains: params.propertiesContains,
    gte: params.since,
    lte: params.until,
  });
  const nameList = Prisma.join(names.map((name) => Prisma.sql`${name}`));

  const rows = await prisma.$queryRaw<LatestEventByNameRow[]>(Prisma.sql`
    SELECT DISTINCT ON (e."name")
      e."id",
      e."name",
      e."app",
      e."platform",
      e."environment",
      e."release",
      e."created_at"
    FROM "Event" e
    WHERE ${whereSql}
      AND e."name" IN (${nameList})
    ORDER BY e."name", e."created_at" DESC
  `);

  return new Map(rows.map((row) => [row.name, row]));
}
