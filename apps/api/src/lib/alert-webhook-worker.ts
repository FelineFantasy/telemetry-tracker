/**
 * Alert webhook delivery worker — claim PENDING/FAILED rows, DNS-pin SSRF check, POST, retry/DEAD.
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  buildAlertWebhookPayload,
  postWebhookOnce,
  signWebhookBody,
  WEBHOOK_MAX_ATTEMPTS,
  type WebhookDnsLookup,
  type WebhookSendImpl,
} from "./alert-webhook-dispatch.js";
import {
  claimNextAlertWebhookDelivery,
  completeAlertWebhookDelivery,
  failAlertWebhookDeliveryAttempt,
  finalizeAlertWebhookDeliverySuccess,
  releaseAlertWebhookDeliveryClaim,
  renewAlertWebhookDeliveryLease,
  type AlertWebhookDeliveryClaim,
} from "./alert-webhook-delivery-job.js";

export type AlertWebhookWorkerDeps = {
  prisma: PrismaClient;
  env?: NodeJS.ProcessEnv;
  now?: () => Date;
  workerId?: string;
  sendImpl?: WebhookSendImpl;
  lookupFn?: WebhookDnsLookup;
};

export type AlertWebhookWorkerProcessResult =
  | { status: "idle" }
  | { status: "success"; deliveryId: string }
  | { status: "failed"; deliveryId: string; terminal: "FAILED" | "DEAD"; error: string };

export async function processNextAlertWebhookDelivery(
  deps: AlertWebhookWorkerDeps
): Promise<AlertWebhookWorkerProcessResult> {
  const nowFn = deps.now ?? (() => new Date());
  const now = nowFn();
  const workerId = deps.workerId ?? `alert-webhook-worker-${randomUUID()}`;

  const job = await claimNextAlertWebhookDelivery(deps.prisma, {
    workerId,
    now,
    env: deps.env,
  });
  if (!job) {
    return { status: "idle" };
  }

  return deliverClaimedAlertWebhook(deps, job, workerId, nowFn);
}

async function deliverClaimedAlertWebhook(
  deps: AlertWebhookWorkerDeps,
  job: AlertWebhookDeliveryClaim,
  workerId: string,
  nowFn: () => Date
): Promise<AlertWebhookWorkerProcessResult> {
  const webhook = await deps.prisma.projectWebhook.findFirst({
    where: { id: job.webhookId, deleted_at: null },
    select: { id: true, url: true, signing_secret: true, enabled: true },
  });

  if (!webhook || !webhook.enabled) {
    const terminal = await failAlertWebhookDeliveryAttempt(deps.prisma, {
      deliveryId: job.id,
      workerId,
      attempt: WEBHOOK_MAX_ATTEMPTS,
      httpStatus: null,
      error: webhook ? "Webhook disabled" : "Webhook not found",
      now: nowFn(),
    });
    return {
      status: "failed",
      deliveryId: job.id,
      terminal: terminal ?? "DEAD",
      error: webhook ? "Webhook disabled" : "Webhook not found",
    };
  }

  // Real queue rows always have an alert event. Null means deleted event (SetNull)
  // or a test delivery that should never have been claimed — never invent a payload.
  if (!job.alertEventId) {
    const terminal = await failAlertWebhookDeliveryAttempt(deps.prisma, {
      deliveryId: job.id,
      workerId,
      attempt: WEBHOOK_MAX_ATTEMPTS,
      httpStatus: null,
      error: "Alert event missing",
      now: nowFn(),
    });
    return {
      status: "failed",
      deliveryId: job.id,
      terminal: terminal ?? "DEAD",
      error: "Alert event missing",
    };
  }

  const event = await deps.prisma.alertEvent.findUnique({
    where: { id: job.alertEventId },
    select: {
      rule: true,
      title: true,
      body: true,
      href: true,
      fired_at: true,
    },
  });
  if (!event) {
    const terminal = await failAlertWebhookDeliveryAttempt(deps.prisma, {
      deliveryId: job.id,
      workerId,
      attempt: WEBHOOK_MAX_ATTEMPTS,
      httpStatus: null,
      error: "Alert event missing",
      now: nowFn(),
    });
    return {
      status: "failed",
      deliveryId: job.id,
      terminal: terminal ?? "DEAD",
      error: "Alert event missing",
    };
  }
  const rule = event.rule;
  const title = event.title;
  const body = event.body;
  const href = event.href;
  const firedAt = event.fired_at;

  const payload = buildAlertWebhookPayload({
    deliveryId: job.id,
    projectId: job.projectId,
    rule,
    title,
    body,
    href,
    dedupeKey: job.dedupeKey,
    firedAt,
  });
  const bodyJson = JSON.stringify(payload);
  const signature = webhook.signing_secret
    ? signWebhookBody(bodyJson, webhook.signing_secret)
    : null;

  const sendImpl =
    deps.sendImpl ??
    (async (input) =>
      postWebhookOnce(input.url, input.body, input.signature, input.deliveryId, {
        lookupFn: input.lookupFn ?? deps.lookupFn,
      }));

  // Renew before POST so a slow/hung recipient cannot expire the lease mid-flight
  // and leave a successful delivery stuck in PROCESSING (duplicate on reclaim).
  const leaseHeld = await renewAlertWebhookDeliveryLease(deps.prisma, {
    deliveryId: job.id,
    workerId,
    now: nowFn(),
    env: deps.env,
  });
  if (!leaseHeld) {
    // Best-effort release (same ownership guard as renew). If another worker
    // already reclaimed, this is a no-op; otherwise clear PROCESSING immediately
    // without burning the claim's attempt toward DEAD.
    await releaseAlertWebhookDeliveryClaim(deps.prisma, {
      deliveryId: job.id,
      workerId,
      error: "Lease lost before delivery",
      now: nowFn(),
      undoAttemptIncrement: job.attemptChargedOnClaim,
    });
    return {
      status: "failed",
      deliveryId: job.id,
      terminal: "FAILED",
      error: "Lease lost before delivery",
    };
  }

  const result = await sendImpl({
    url: webhook.url,
    body: bodyJson,
    signature,
    deliveryId: job.id,
    lookupFn: deps.lookupFn,
  });

  if (result.ok) {
    const completed = await completeAlertWebhookDelivery(deps.prisma, {
      deliveryId: job.id,
      workerId,
      httpStatus: result.httpStatus,
    });
    if (completed) {
      return { status: "success", deliveryId: job.id };
    }
    // HTTP already succeeded — still mark SUCCESS without the lease so the row
    // cannot stay PROCESSING and be reclaimed for a duplicate POST.
    const finalized = await finalizeAlertWebhookDeliverySuccess(deps.prisma, {
      deliveryId: job.id,
      httpStatus: result.httpStatus,
    });
    if (finalized) {
      return { status: "success", deliveryId: job.id };
    }
    return {
      status: "failed",
      deliveryId: job.id,
      terminal: "FAILED",
      error: "Could not finalize successful delivery",
    };
  }

  const terminal = await failAlertWebhookDeliveryAttempt(deps.prisma, {
    deliveryId: job.id,
    workerId,
    attempt: job.attempt,
    httpStatus: result.httpStatus,
    error: result.error,
    now: nowFn(),
  });

  return {
    status: "failed",
    deliveryId: job.id,
    terminal: terminal ?? "DEAD",
    error: result.error,
  };
}
