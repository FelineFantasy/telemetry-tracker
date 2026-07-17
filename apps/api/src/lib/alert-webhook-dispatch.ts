import { createHmac, randomBytes, randomUUID } from "node:crypto";
import type { AlertRuleType, PrismaClient } from "@prisma/client";
import { dashboardOriginOrNull } from "./dashboard-origin.js";

export const MAX_PROJECT_WEBHOOKS = 5;
export const WEBHOOK_MAX_ATTEMPTS = 2;
export const WEBHOOK_RETRY_DELAY_MS = 500;
export const WEBHOOK_FETCH_TIMEOUT_MS = 8_000;

export type AlertWebhookPayload = {
  version: 1;
  event: "alert.fired";
  deliveryId: string;
  firedAt: string;
  projectId: string;
  rule: AlertRuleType;
  title: string;
  body: string;
  href: string | null;
  dedupeKey: string;
};

export type ProjectWebhookPublic = {
  id: string;
  urlMasked: string;
  label: string | null;
  enabled: boolean;
  hasSigningSecret: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AlertWebhookDeliveryPublic = {
  id: string;
  webhookId: string;
  webhookLabel: string | null;
  webhookUrlMasked: string;
  status: "SUCCESS" | "FAILED" | "DEAD";
  attempt: number;
  httpStatus: number | null;
  error: string | null;
  createdAt: string;
};

export function generateWebhookSigningSecret(): string {
  return randomBytes(32).toString("hex");
}

export function validateWebhookUrl(
  raw: unknown
): { ok: true; url: string } | { ok: false; error: string } {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, error: "Webhook URL is required" };
  }
  const trimmed = raw.trim();
  if (trimmed.length > 2048) {
    return { ok: false, error: "Webhook URL is too long" };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Webhook URL is invalid" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Webhook URL must use HTTPS" };
  }
  if (!parsed.hostname) {
    return { ok: false, error: "Webhook URL host is not allowed" };
  }
  if (isBlockedWebhookHostname(parsed.hostname)) {
    return { ok: false, error: "Webhook URL host is not allowed" };
  }
  return { ok: true, url: parsed.toString() };
}

/** Block obvious SSRF targets (loopback / link-local / private / cloud metadata). */
export function isBlockedWebhookHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host === "metadata.google.internal" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  if (host.includes(":")) {
    // IPv6 — allow only if clearly not loopback/link-local/ULA (conservative reject of bare IPv6 literals).
    return true;
  }

  // Reject dotted / shorthand numeric hosts (e.g. 127.0.0.1, 127.1, 10.1) — not public DNS names.
  if (/^\d+(?:\.\d+){0,3}$/.test(host)) {
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4) {
      // Incomplete IPv4 shorthand (127.1, 10.0.0, …) often resolves as loopback/private.
      return true;
    }
    const parts = ipv4.slice(1).map((p) => Number(p));
    if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    // Any other literal IPv4 — block to avoid SSRF via public-looking but operator-controlled IPs
    // is overly strict; allow non-private dotted quads only.
    return false;
  }

  return false;
}

export function maskWebhookUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : "/***";
    return `${parsed.protocol}//${parsed.host}${path}`;
  } catch {
    return "***";
  }
}

export function signWebhookBody(body: string, secret: string): string {
  const digest = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  return `sha256=${digest}`;
}

export function absoluteAlertHref(href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  const base = dashboardOriginOrNull();
  if (!base) return href;
  return `${base.replace(/\/$/, "")}${href.startsWith("/") ? href : `/${href}`}`;
}

export function buildAlertWebhookPayload(input: {
  deliveryId: string;
  projectId: string;
  rule: AlertRuleType;
  title: string;
  body: string;
  href: string | null;
  dedupeKey: string;
  firedAt?: Date;
}): AlertWebhookPayload {
  return {
    version: 1,
    event: "alert.fired",
    deliveryId: input.deliveryId,
    firedAt: (input.firedAt ?? new Date()).toISOString(),
    projectId: input.projectId,
    rule: input.rule,
    title: input.title,
    body: input.body,
    href: absoluteAlertHref(input.href),
    dedupeKey: input.dedupeKey,
  };
}

export function toProjectWebhookPublic(row: {
  id: string;
  url: string;
  label: string | null;
  enabled: boolean;
  signing_secret: string | null;
  created_at: Date;
  updated_at: Date;
}): ProjectWebhookPublic {
  return {
    id: row.id,
    urlMasked: maskWebhookUrl(row.url),
    label: row.label,
    enabled: row.enabled,
    hasSigningSecret: Boolean(row.signing_secret),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listProjectWebhooks(
  prisma: PrismaClient,
  projectId: string
): Promise<ProjectWebhookPublic[]> {
  const rows = await prisma.projectWebhook.findMany({
    where: { project_id: projectId, deleted_at: null },
    orderBy: { created_at: "asc" },
  });
  return rows.map(toProjectWebhookPublic);
}

/** Recent delivery attempts for a project (operator-facing log). */
export async function listAlertWebhookDeliveries(
  prisma: PrismaClient,
  projectId: string,
  options?: { limit?: number; webhookId?: string }
): Promise<AlertWebhookDeliveryPublic[]> {
  const limitRaw = options?.limit ?? 25;
  const limit = Number.isFinite(limitRaw)
    ? Math.min(50, Math.max(1, Math.floor(limitRaw)))
    : 25;
  const webhookId =
    typeof options?.webhookId === "string" && options.webhookId.trim().length > 0
      ? options.webhookId.trim()
      : undefined;

  const rows = await prisma.alertWebhookDelivery.findMany({
    where: {
      project_id: projectId,
      ...(webhookId ? { webhook_id: webhookId } : {}),
    },
    orderBy: { created_at: "desc" },
    take: limit,
    select: {
      id: true,
      webhook_id: true,
      status: true,
      attempt: true,
      http_status: true,
      error: true,
      created_at: true,
      webhook: {
        select: {
          label: true,
          url: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    webhookId: row.webhook_id,
    webhookLabel: row.webhook.label,
    webhookUrlMasked: maskWebhookUrl(row.webhook.url),
    status: row.status,
    attempt: row.attempt,
    httpStatus: row.http_status,
    error: row.error,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function countActiveProjectWebhooks(
  prisma: PrismaClient,
  projectId: string
): Promise<number> {
  return prisma.projectWebhook.count({
    where: { project_id: projectId, deleted_at: null },
  });
}

type CreateWebhookInput = {
  url: string;
  label?: string | null;
  enabled?: boolean;
  withSigningSecret?: boolean;
};

export async function createProjectWebhook(
  prisma: PrismaClient,
  projectId: string,
  input: CreateWebhookInput
): Promise<
  | { ok: true; webhook: ProjectWebhookPublic; signingSecret: string | null }
  | { ok: false; error: string; status: 400 | 409 }
> {
  const validated = validateWebhookUrl(input.url);
  if (!validated.ok) {
    return { ok: false, error: validated.error, status: 400 };
  }

  const count = await countActiveProjectWebhooks(prisma, projectId);
  if (count >= MAX_PROJECT_WEBHOOKS) {
    return {
      ok: false,
      error: `At most ${MAX_PROJECT_WEBHOOKS} webhooks per project`,
      status: 409,
    };
  }

  const label =
    typeof input.label === "string" && input.label.trim().length > 0
      ? input.label.trim().slice(0, 80)
      : null;
  const signingSecret = input.withSigningSecret === false ? null : generateWebhookSigningSecret();

  const row = await prisma.projectWebhook.create({
    data: {
      id: randomUUID(),
      project_id: projectId,
      url: validated.url,
      label,
      enabled: input.enabled !== false,
      signing_secret: signingSecret,
    },
  });

  return {
    ok: true,
    webhook: toProjectWebhookPublic(row),
    signingSecret,
  };
}

export async function updateProjectWebhook(
  prisma: PrismaClient,
  projectId: string,
  webhookId: string,
  patch: {
    url?: string;
    label?: string | null;
    enabled?: boolean;
    rotateSigningSecret?: boolean;
    clearSigningSecret?: boolean;
  }
): Promise<
  | {
      ok: true;
      webhook: ProjectWebhookPublic;
      signingSecret: string | null;
    }
  | { ok: false; error: string; status: 400 | 404 }
> {
  const existing = await prisma.projectWebhook.findFirst({
    where: { id: webhookId, project_id: projectId, deleted_at: null },
  });
  if (!existing) {
    return { ok: false, error: "Webhook not found", status: 404 };
  }

  let nextUrl = existing.url;
  if (patch.url !== undefined) {
    const validated = validateWebhookUrl(patch.url);
    if (!validated.ok) {
      return { ok: false, error: validated.error, status: 400 };
    }
    nextUrl = validated.url;
  }

  let nextLabel = existing.label;
  if (patch.label !== undefined) {
    nextLabel =
      typeof patch.label === "string" && patch.label.trim().length > 0
        ? patch.label.trim().slice(0, 80)
        : null;
  }

  let nextSecret = existing.signing_secret;
  let rotatedSecret: string | null = null;
  if (patch.clearSigningSecret) {
    nextSecret = null;
  } else if (patch.rotateSigningSecret) {
    rotatedSecret = generateWebhookSigningSecret();
    nextSecret = rotatedSecret;
  }

  const row = await prisma.projectWebhook.update({
    where: { id: existing.id },
    data: {
      url: nextUrl,
      label: nextLabel,
      enabled: patch.enabled ?? existing.enabled,
      signing_secret: nextSecret,
    },
  });

  return {
    ok: true,
    webhook: toProjectWebhookPublic(row),
    signingSecret: rotatedSecret,
  };
}

export async function softDeleteProjectWebhook(
  prisma: PrismaClient,
  projectId: string,
  webhookId: string
): Promise<{ ok: true } | { ok: false; error: string; status: 404 }> {
  const result = await prisma.projectWebhook.updateMany({
    where: { id: webhookId, project_id: projectId, deleted_at: null },
    data: { deleted_at: new Date(), enabled: false },
  });
  if (result.count === 0) {
    return { ok: false, error: "Webhook not found", status: 404 };
  }
  return { ok: true };
}

type DispatchAlertInput = {
  projectId: string;
  alertEventId: string;
  rule: AlertRuleType;
  title: string;
  body: string;
  href: string | null;
  dedupeKey: string;
  firedAt?: Date;
};

type FetchImpl = typeof fetch;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWebhookOnce(
  url: string,
  body: string,
  signature: string | null,
  deliveryId: string,
  fetchImpl: FetchImpl
): Promise<{ ok: true; httpStatus: number } | { ok: false; httpStatus: number | null; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "TelemetryTracker-Webhooks/1.0",
      "X-Telemetry-Event": "alert.fired",
      "X-Telemetry-Delivery": deliveryId,
    };
    if (signature) {
      headers["X-Telemetry-Signature"] = signature;
    }
    const res = await fetchImpl(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      // Do not follow redirects — a 302 to a private host would bypass create-time SSRF checks.
      redirect: "manual",
    });
    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
      return {
        ok: false,
        httpStatus: res.status,
        error: `HTTP ${res.status} (redirect not followed)`,
      };
    }
    if (res.ok) {
      return { ok: true, httpStatus: res.status };
    }
    return {
      ok: false,
      httpStatus: res.status,
      error: `HTTP ${res.status}`,
    };
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.name === "AbortError"
          ? "Request timed out"
          : e.message
        : "Request failed";
    return { ok: false, httpStatus: null, error: message.slice(0, 400) };
  } finally {
    clearTimeout(timer);
  }
}

/** Deliver an alert payload to all enabled project webhooks (best-effort, with retry). */
export async function dispatchAlertWebhooks(
  prisma: PrismaClient,
  input: DispatchAlertInput,
  options?: { fetchImpl?: FetchImpl }
): Promise<void> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const webhooks = await prisma.projectWebhook.findMany({
    where: {
      project_id: input.projectId,
      deleted_at: null,
      enabled: true,
    },
    select: {
      id: true,
      url: true,
      signing_secret: true,
    },
  });
  if (webhooks.length === 0) return;

  await Promise.all(
    webhooks.map(async (webhook) => {
      for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt++) {
        const deliveryId = randomUUID();
        const payload = buildAlertWebhookPayload({
          deliveryId,
          projectId: input.projectId,
          rule: input.rule,
          title: input.title,
          body: input.body,
          href: input.href,
          dedupeKey: input.dedupeKey,
          firedAt: input.firedAt,
        });
        const body = JSON.stringify(payload);
        const signature = webhook.signing_secret
          ? signWebhookBody(body, webhook.signing_secret)
          : null;

        const result = await postWebhookOnce(
          webhook.url,
          body,
          signature,
          deliveryId,
          fetchImpl
        );

        if (result.ok) {
          await prisma.alertWebhookDelivery.create({
            data: {
              id: randomUUID(),
              webhook_id: webhook.id,
              project_id: input.projectId,
              alert_event_id: input.alertEventId,
              dedupe_key: input.dedupeKey,
              attempt,
              status: "SUCCESS",
              http_status: result.httpStatus,
            },
          });
          return;
        }

        const isLast = attempt >= WEBHOOK_MAX_ATTEMPTS;
        await prisma.alertWebhookDelivery.create({
          data: {
            id: randomUUID(),
            webhook_id: webhook.id,
            project_id: input.projectId,
            alert_event_id: input.alertEventId,
            dedupe_key: input.dedupeKey,
            attempt,
            status: isLast ? "DEAD" : "FAILED",
            http_status: result.httpStatus,
            error: result.error,
          },
        });

        if (!isLast) {
          await sleep(WEBHOOK_RETRY_DELAY_MS);
        }
      }
    })
  );
}

/** Send a sample alert payload to one webhook (editors testing the destination). */
export async function sendTestWebhook(
  prisma: PrismaClient,
  projectId: string,
  webhookId: string,
  options?: { fetchImpl?: FetchImpl }
): Promise<
  | { ok: true; httpStatus: number }
  | { ok: false; error: string; status: 404 | 502; httpStatus?: number | null }
> {
  const webhook = await prisma.projectWebhook.findFirst({
    where: { id: webhookId, project_id: projectId, deleted_at: null },
  });
  if (!webhook) {
    return { ok: false, error: "Webhook not found", status: 404 };
  }

  const deliveryId = randomUUID();
  const dedupeKey = `webhook:test:${webhook.id}:${deliveryId}`;
  const payload = buildAlertWebhookPayload({
    deliveryId,
    projectId,
    rule: "ERROR_SPIKE",
    title: "Test webhook from Telemetry Tracker",
    body: "This is a sample alert.fired payload so you can verify your endpoint.",
    href: "/dashboard/alerts",
    dedupeKey,
  });
  const body = JSON.stringify(payload);
  const signature = webhook.signing_secret
    ? signWebhookBody(body, webhook.signing_secret)
    : null;
  const result = await postWebhookOnce(
    webhook.url,
    body,
    signature,
    deliveryId,
    options?.fetchImpl ?? fetch
  );

  await prisma.alertWebhookDelivery.create({
    data: {
      id: randomUUID(),
      webhook_id: webhook.id,
      project_id: projectId,
      dedupe_key: dedupeKey,
      attempt: 1,
      status: result.ok ? "SUCCESS" : "DEAD",
      http_status: result.httpStatus,
      error: result.ok ? null : result.error,
    },
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
      status: 502,
      httpStatus: result.httpStatus,
    };
  }
  return { ok: true, httpStatus: result.httpStatus };
}
