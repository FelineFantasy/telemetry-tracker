/**
 * Brief acknowledgement helpers.
 *
 * `acknowledged_through` advances only on explicit "Mark as read". It never moves backward.
 * Upserts use database-level GREATEST() for concurrency safety.
 */

import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { AcknowledgeBriefRequest } from "./brief-contracts.js";

/** Never move the acknowledgement watermark backward. */
export function advanceAcknowledgedThrough(
  existing: Date | null,
  incoming: Date
): Date {
  if (existing === null) return incoming;
  return new Date(Math.max(existing.getTime(), incoming.getTime()));
}

export type BriefAckMeta = {
  requestId: string;
  snapshotHash: string;
};

/**
 * Pure comparison of ack payload metadata against expected brief metadata.
 * Does not prove the brief was actually served — Phase 3C adds server-side checks.
 */
export function validateAckAgainstBriefMeta(
  req: Pick<AcknowledgeBriefRequest, "requestId" | "snapshotHash">,
  meta: BriefAckMeta
): { ok: true } | { ok: false; error: string } {
  if (req.requestId !== meta.requestId) {
    return { ok: false, error: "requestId does not match the current brief" };
  }
  if (req.snapshotHash !== meta.snapshotHash) {
    return { ok: false, error: "snapshotHash does not match the current brief" };
  }
  return { ok: true };
}

/** Load acknowledgement watermarks for the given projects (missing rows omitted). */
export async function loadBriefAcknowledgements(
  prisma: PrismaClient,
  userId: string,
  projectIds: string[]
): Promise<Map<string, Date>> {
  if (projectIds.length === 0) return new Map();

  const rows = await prisma.briefAcknowledgement.findMany({
    where: { user_id: userId, project_id: { in: projectIds } },
    select: { project_id: true, acknowledged_through: true },
  });

  return new Map(rows.map((r) => [r.project_id, r.acknowledged_through]));
}

export type BriefAckUpsertEntry = {
  projectId: string;
  acknowledgedThrough: Date;
};

type AckUpsertRow = {
  project_id: string;
  acknowledged_through: Date;
  updated_at: Date;
};

/**
 * Atomically upsert per-project watermarks.
 * `updated_at` changes only when the stored watermark advances.
 */
export async function upsertBriefAcknowledgements(
  prisma: PrismaClient,
  userId: string,
  entries: BriefAckUpsertEntry[]
): Promise<Array<{ projectId: string; acknowledgedThrough: string }>> {
  if (entries.length === 0) return [];

  const results = await prisma.$transaction(
    entries.map((entry) => {
      const id = randomUUID();
      return prisma.$queryRaw<AckUpsertRow[]>(Prisma.sql`
        INSERT INTO "BriefAcknowledgement" (
          id,
          user_id,
          project_id,
          acknowledged_through,
          created_at,
          updated_at
        )
        VALUES (
          ${id},
          ${userId},
          ${entry.projectId},
          ${entry.acknowledgedThrough},
          NOW(),
          NOW()
        )
        ON CONFLICT (user_id, project_id)
        DO UPDATE SET
          acknowledged_through = GREATEST(
            "BriefAcknowledgement".acknowledged_through,
            EXCLUDED.acknowledged_through
          ),
          updated_at = CASE
            WHEN EXCLUDED.acknowledged_through >
                 "BriefAcknowledgement".acknowledged_through
            THEN NOW()
            ELSE "BriefAcknowledgement".updated_at
          END
        RETURNING project_id, acknowledged_through, updated_at
      `);
    })
  );

  return results.flat().map((row) => ({
    projectId: row.project_id,
    acknowledgedThrough: row.acknowledged_through.toISOString(),
  }));
}

/** @internal Test helper: read stored acknowledgement row. */
export async function getBriefAcknowledgementRow(
  prisma: PrismaClient,
  userId: string,
  projectId: string
) {
  return prisma.briefAcknowledgement.findUnique({
    where: {
      user_id_project_id: {
        user_id: userId,
        project_id: projectId,
      },
    },
  });
}
