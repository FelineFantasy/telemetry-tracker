/**
 * Postgres-backed alert webhook delivery queue (claim / lease), mirroring brief-generation-job.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { AlertWebhookDeliveryStatus } from "@prisma/client";
import {
  resolveAlertWebhookWorkerLeaseMs,
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_DELAY_MS,
} from "./alert-webhook-dispatch.js";

export type AlertWebhookDeliveryJobRow = {
  id: string;
  webhookId: string;
  projectId: string;
  alertEventId: string | null;
  dedupeKey: string;
  attempt: number;
  status: AlertWebhookDeliveryStatus;
  httpStatus: number | null;
  error: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  nextAttemptAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type DeliveryDbRow = {
  id: string;
  webhook_id: string;
  project_id: string;
  alert_event_id: string | null;
  dedupe_key: string;
  attempt: number;
  status: AlertWebhookDeliveryStatus;
  http_status: number | null;
  error: string | null;
  lease_owner: string | null;
  lease_expires_at: Date | null;
  next_attempt_at: Date;
  created_at: Date;
  updated_at: Date;
};

function mapDelivery(row: DeliveryDbRow): AlertWebhookDeliveryJobRow {
  return {
    id: row.id,
    webhookId: row.webhook_id,
    projectId: row.project_id,
    alertEventId: row.alert_event_id,
    dedupeKey: row.dedupe_key,
    attempt: row.attempt,
    status: row.status,
    httpStatus: row.http_status,
    error: row.error,
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at,
    nextAttemptAt: row.next_attempt_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function claimNextAlertWebhookDelivery(
  prisma: PrismaClient,
  input: { workerId: string; now: Date; env?: NodeJS.ProcessEnv }
): Promise<AlertWebhookDeliveryJobRow | null> {
  const leaseMs = resolveAlertWebhookWorkerLeaseMs(input.env);
  const leaseExpiresAt = new Date(input.now.getTime() + leaseMs);

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<DeliveryDbRow[]>(Prisma.sql`
      SELECT *
      FROM "AlertWebhookDelivery"
      WHERE "status" IN ('PENDING', 'FAILED', 'PROCESSING')
        AND "next_attempt_at" <= ${input.now}
        AND ("lease_expires_at" IS NULL OR "lease_expires_at" < ${input.now})
      ORDER BY "next_attempt_at" ASC, "created_at" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    const candidate = rows[0];
    if (!candidate) return null;

    const updated = await tx.alertWebhookDelivery.update({
      where: { id: candidate.id },
      data: {
        status: AlertWebhookDeliveryStatus.PROCESSING,
        lease_owner: input.workerId,
        lease_expires_at: leaseExpiresAt,
        attempt: { increment: 1 },
        error: null,
        http_status: null,
      },
    });

    return mapDelivery(updated);
  });
}

export async function renewAlertWebhookDeliveryLease(
  prisma: PrismaClient,
  input: { deliveryId: string; workerId: string; now: Date; env?: NodeJS.ProcessEnv }
): Promise<boolean> {
  const leaseExpiresAt = new Date(
    input.now.getTime() + resolveAlertWebhookWorkerLeaseMs(input.env)
  );
  const result = await prisma.alertWebhookDelivery.updateMany({
    where: {
      id: input.deliveryId,
      lease_owner: input.workerId,
      status: AlertWebhookDeliveryStatus.PROCESSING,
    },
    data: { lease_expires_at: leaseExpiresAt },
  });
  return result.count > 0;
}

export async function completeAlertWebhookDelivery(
  prisma: PrismaClient,
  input: {
    deliveryId: string;
    workerId: string;
    httpStatus: number;
  }
): Promise<boolean> {
  const result = await prisma.alertWebhookDelivery.updateMany({
    where: {
      id: input.deliveryId,
      lease_owner: input.workerId,
      status: AlertWebhookDeliveryStatus.PROCESSING,
    },
    data: {
      status: AlertWebhookDeliveryStatus.SUCCESS,
      http_status: input.httpStatus,
      error: null,
      lease_owner: null,
      lease_expires_at: null,
    },
  });
  return result.count > 0;
}

/**
 * After a successful HTTP POST, finalize SUCCESS even if the worker lost its lease.
 * Prevents a stuck PROCESSING row from being reclaimed and POSTed again.
 */
export async function finalizeAlertWebhookDeliverySuccess(
  prisma: PrismaClient,
  input: { deliveryId: string; httpStatus: number }
): Promise<boolean> {
  const result = await prisma.alertWebhookDelivery.updateMany({
    where: {
      id: input.deliveryId,
      status: AlertWebhookDeliveryStatus.PROCESSING,
    },
    data: {
      status: AlertWebhookDeliveryStatus.SUCCESS,
      http_status: input.httpStatus,
      error: null,
      lease_owner: null,
      lease_expires_at: null,
    },
  });
  return result.count > 0;
}

export async function failAlertWebhookDeliveryAttempt(
  prisma: PrismaClient,
  input: {
    deliveryId: string;
    workerId: string;
    attempt: number;
    httpStatus: number | null;
    error: string;
    now: Date;
  }
): Promise<"FAILED" | "DEAD" | null> {
  const isDead = input.attempt >= WEBHOOK_MAX_ATTEMPTS;
  const nextAttemptAt = isDead
    ? input.now
    : new Date(input.now.getTime() + WEBHOOK_RETRY_DELAY_MS);

  const result = await prisma.alertWebhookDelivery.updateMany({
    where: {
      id: input.deliveryId,
      lease_owner: input.workerId,
      status: AlertWebhookDeliveryStatus.PROCESSING,
    },
    data: {
      status: isDead
        ? AlertWebhookDeliveryStatus.DEAD
        : AlertWebhookDeliveryStatus.FAILED,
      http_status: input.httpStatus,
      error: input.error.slice(0, 400),
      lease_owner: null,
      lease_expires_at: null,
      next_attempt_at: nextAttemptAt,
    },
  });
  if (result.count === 0) return null;
  return isDead ? "DEAD" : "FAILED";
}
