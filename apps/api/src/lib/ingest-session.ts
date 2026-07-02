import type { PrismaClient } from "@prisma/client";
import { normalizeMapAppLabel } from "./source-map-artifact.js";

export async function findIngestSession(
  prisma: PrismaClient,
  projectId: string,
  sessionId: string,
  app: string
) {
  const rows = await prisma.session.findMany({
    where: { project_id: projectId, session_id: sessionId },
    orderBy: { started_at: "desc" },
  });
  return rows.find((row) => normalizeMapAppLabel(row.app) === app) ?? null;
}
