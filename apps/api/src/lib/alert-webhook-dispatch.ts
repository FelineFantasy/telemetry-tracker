import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import https from "node:https";
import { isIP } from "node:net";
import type { AlertRuleType, AlertWebhookDeliveryStatus, Prisma, PrismaClient } from "@prisma/client";
import { dashboardOriginOrNull } from "./dashboard-origin.js";

export const MAX_PROJECT_WEBHOOKS = 5;
export const WEBHOOK_MAX_ATTEMPTS = 2;
export const WEBHOOK_RETRY_DELAY_MS = 500;
export const WEBHOOK_FETCH_TIMEOUT_MS = 8_000;
export const WEBHOOK_WORKER_LEASE_MS_DEFAULT = 30_000;
export const WEBHOOK_WORKER_POLL_MS_DEFAULT = 1_000;

export type WebhookDnsAddress = { address: string; family: 4 | 6 };

/** Injectable DNS resolver for delivery-time SSRF checks (tests mock this). */
export type WebhookDnsLookup = (hostname: string) => Promise<WebhookDnsAddress[]>;

export type WebhookSendResult =
  | { ok: true; httpStatus: number }
  | { ok: false; httpStatus: number | null; error: string };

/** Injectable POST transport (defaults to DNS-pinned HTTPS). */
export type WebhookSendImpl = (input: {
  url: string;
  body: string;
  signature: string | null;
  deliveryId: string;
  lookupFn?: WebhookDnsLookup;
}) => Promise<WebhookSendResult>;

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
  status: AlertWebhookDeliveryStatus;
  attempt: number;
  httpStatus: number | null;
  error: string | null;
  createdAt: string;
};

export function generateWebhookSigningSecret(): string {
  return randomBytes(32).toString("hex");
}

export function resolveAlertWebhookWorkerPollMs(
  env: NodeJS.ProcessEnv = process.env
): number {
  const raw = env.ALERT_WEBHOOK_WORKER_POLL_MS;
  if (raw === undefined || raw.trim() === "") return WEBHOOK_WORKER_POLL_MS_DEFAULT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return WEBHOOK_WORKER_POLL_MS_DEFAULT;
  return parsed;
}

export function resolveAlertWebhookWorkerLeaseMs(
  env: NodeJS.ProcessEnv = process.env
): number {
  const raw = env.ALERT_WEBHOOK_WORKER_LEASE_MS;
  if (raw === undefined || raw.trim() === "") return WEBHOOK_WORKER_LEASE_MS_DEFAULT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return WEBHOOK_WORKER_LEASE_MS_DEFAULT;
  return parsed;
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

/** True for loopback / link-local / private / CGNAT / unspecified IPv4. */
export function isBlockedIpv4Address(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

/** Expand a valid IPv6 literal into eight 16-bit hextets (handles dotted-decimal tails). */
function parseIpv6Hextets(ip: string): Uint16Array | null {
  const host = ip.toLowerCase().trim();
  if (isIP(host) !== 6) return null;

  let normalized = host;
  const dotted = normalized.match(/^(.+):(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (dotted) {
    const octets = [Number(dotted[2]), Number(dotted[3]), Number(dotted[4]), Number(dotted[5])];
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const hi = ((octets[0]! << 8) | octets[1]!) >>> 0;
    const lo = ((octets[2]! << 8) | octets[3]!) >>> 0;
    normalized = `${dotted[1]}:${hi.toString(16)}:${lo.toString(16)}`;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;

  const parsePart = (part: string): number[] | null => {
    if (part === "") return [];
    const out: number[] = [];
    for (const hextet of part.split(":")) {
      if (!/^[0-9a-f]{1,4}$/i.test(hextet)) return null;
      out.push(Number.parseInt(hextet, 16));
    }
    return out;
  };

  let hextets: number[];
  if (halves.length === 1) {
    const parts = parsePart(halves[0]!);
    if (!parts || parts.length !== 8) return null;
    hextets = parts;
  } else {
    const left = parsePart(halves[0]!);
    const right = parsePart(halves[1]!);
    if (!left || !right) return null;
    const fill = 8 - left.length - right.length;
    if (fill < 0) return null;
    hextets = [...left, ...Array.from({ length: fill }, () => 0), ...right];
    if (hextets.length !== 8) return null;
  }

  return Uint16Array.from(hextets);
}

function ipv4DottedFromHextets(hi: number, lo: number): string {
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

/**
 * True for loopback / link-local / ULA / multicast / unspecified IPv6,
 * plus IPv4-mapped (`::ffff:…`) and IPv4-compatible (`::x.x.x.x`) embeddings
 * in any valid encoding (compressed, expanded, hex-mapped).
 */
export function isBlockedIpv6Address(ip: string): boolean {
  const hextets = parseIpv6Hextets(ip);
  if (!hextets) return true;

  const h0 = hextets[0]!;
  const h1 = hextets[1]!;
  const h2 = hextets[2]!;
  const h3 = hextets[3]!;
  const h4 = hextets[4]!;
  const h5 = hextets[5]!;
  const h6 = hextets[6]!;
  const h7 = hextets[7]!;

  // Unspecified ::
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0 && h6 === 0 && h7 === 0) {
    return true;
  }
  // Loopback ::1
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0 && h6 === 0 && h7 === 1) {
    return true;
  }

  // IPv4-mapped ::ffff:0:0/96 (dotted or hex-mapped encodings)
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0xffff) {
    return isBlockedIpv4Address(ipv4DottedFromHextets(h6, h7));
  }
  // Deprecated IPv4-compatible ::/96 (e.g. ::127.0.0.1)
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0) {
    return isBlockedIpv4Address(ipv4DottedFromHextets(h6, h7));
  }

  if ((h0 & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((h0 & 0xfe00) === 0xfc00) return true; // ULA fc00::/7
  if ((h0 & 0xff00) === 0xff00) return true; // multicast ff00::/8
  return false;
}

/** Block resolved addresses that must never be webhook targets. */
export function isBlockedIpAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isBlockedIpv4Address(ip);
  if (version === 6) return isBlockedIpv6Address(ip);
  return true;
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
    // Bare IPv6 literals — same private/special checks as resolved addresses.
    return isBlockedIpAddress(host);
  }

  // Reject dotted / shorthand numeric hosts (e.g. 127.0.0.1, 127.1, 10.1).
  if (/^\d+(?:\.\d+){0,3}$/.test(host)) {
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!ipv4) {
      return true;
    }
    return isBlockedIpv4Address(host);
  }

  return false;
}

export async function defaultWebhookDnsLookup(hostname: string): Promise<WebhookDnsAddress[]> {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.map((r) => ({
    address: r.address,
    family: (r.family === 6 ? 6 : 4) as 4 | 6,
  }));
}

/**
 * Resolve hostname and reject if any address is private/loopback/link-local.
 * Closes the DNS-rebinding gap left by create-time hostname string checks alone.
 */
export async function resolveWebhookHostForDelivery(
  hostname: string,
  lookupFn: WebhookDnsLookup = defaultWebhookDnsLookup
): Promise<{ ok: true; addresses: WebhookDnsAddress[] } | { ok: false; error: string }> {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) {
    return { ok: false, error: "Webhook URL host is not allowed" };
  }
  if (isBlockedWebhookHostname(host)) {
    return { ok: false, error: "Webhook URL host is not allowed" };
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4 || ipVersion === 6) {
    if (isBlockedIpAddress(host)) {
      return { ok: false, error: "Webhook URL host is not allowed" };
    }
    return { ok: true, addresses: [{ address: host, family: ipVersion }] };
  }

  try {
    const results = await lookupFn(host);
    if (results.length === 0) {
      return { ok: false, error: "Webhook URL host could not be resolved" };
    }
    for (const { address } of results) {
      if (isBlockedIpAddress(address)) {
        return { ok: false, error: "Webhook URL host is not allowed" };
      }
    }
    return { ok: true, addresses: results };
  } catch {
    return { ok: false, error: "Webhook URL host could not be resolved" };
  }
}

/** Prefer IPv4 when both families are present (validated already). */
export function pickPinnedWebhookAddress(addresses: WebhookDnsAddress[]): WebhookDnsAddress {
  return addresses.find((a) => a.family === 4) ?? addresses[0]!;
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

export type EnqueueAlertWebhookInput = {
  projectId: string;
  alertEventId: string;
  dedupeKey: string;
};

/**
 * Persist PENDING delivery rows for each enabled webhook.
 * Must complete before fireProjectAlert returns (durable enqueue).
 */
export async function enqueueAlertWebhookDeliveries(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: EnqueueAlertWebhookInput
): Promise<number> {
  const webhooks = await prisma.projectWebhook.findMany({
    where: {
      project_id: input.projectId,
      deleted_at: null,
      enabled: true,
    },
    select: { id: true },
  });
  if (webhooks.length === 0) return 0;

  const now = new Date();
  await prisma.alertWebhookDelivery.createMany({
    data: webhooks.map((webhook) => ({
      id: randomUUID(),
      webhook_id: webhook.id,
      project_id: input.projectId,
      alert_event_id: input.alertEventId,
      dedupe_key: input.dedupeKey,
      attempt: 0,
      status: "PENDING" as const,
      next_attempt_at: now,
    })),
  });
  return webhooks.length;
}

/**
 * POST over HTTPS while pinning the TCP connect to a pre-validated IP.
 * Uses custom `lookup` so Node never re-resolves (closes DNS rebinding TOCTOU).
 * Redirects are not followed (`https.request` does not auto-follow).
 */
export async function postWebhookOnce(
  url: string,
  body: string,
  signature: string | null,
  deliveryId: string,
  options?: { lookupFn?: WebhookDnsLookup }
): Promise<WebhookSendResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, httpStatus: null, error: "Webhook URL is invalid" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, httpStatus: null, error: "Webhook URL must use HTTPS" };
  }

  const resolved = await resolveWebhookHostForDelivery(
    parsed.hostname,
    options?.lookupFn ?? defaultWebhookDnsLookup
  );
  if (!resolved.ok) {
    return { ok: false, httpStatus: null, error: resolved.error };
  }
  const pinned = pickPinnedWebhookAddress(resolved.addresses);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "TelemetryTracker-Webhooks/1.0",
    "X-Telemetry-Event": "alert.fired",
    "X-Telemetry-Delivery": deliveryId,
    Host: parsed.host,
    "Content-Length": String(Buffer.byteLength(body, "utf8")),
  };
  if (signature) {
    headers["X-Telemetry-Signature"] = signature;
  }

  return new Promise((resolve) => {
    const req = https.request(
      {
        protocol: "https:",
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: "POST",
        headers,
        servername: parsed.hostname,
        timeout: WEBHOOK_FETCH_TIMEOUT_MS,
        // Pin connect to the address we validated — do not call system DNS again.
        lookup: (_hostname, _opts, callback) => {
          callback(null, pinned.address, pinned.family);
        },
      },
      (res) => {
        res.resume();
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          resolve({
            ok: false,
            httpStatus: status,
            error: `HTTP ${status} (redirect not followed)`,
          });
          return;
        }
        if (status >= 200 && status < 300) {
          resolve({ ok: true, httpStatus: status });
          return;
        }
        resolve({
          ok: false,
          httpStatus: status || null,
          error: `HTTP ${status || "unknown"}`,
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Request timed out"));
    });
    req.on("error", (e: unknown) => {
      const message =
        e instanceof Error
          ? e.message === "Request timed out" || e.name === "AbortError"
            ? "Request timed out"
            : e.message
          : "Request failed";
      resolve({ ok: false, httpStatus: null, error: message.slice(0, 400) });
    });

    req.write(body, "utf8");
    req.end();
  });
}

/** Send a sample alert payload to one webhook (editors testing the destination). */
export async function sendTestWebhook(
  prisma: PrismaClient,
  projectId: string,
  webhookId: string,
  options?: { sendImpl?: WebhookSendImpl; lookupFn?: WebhookDnsLookup }
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
  const sendImpl = options?.sendImpl ?? postWebhookOnceAsSendImpl;
  const result = await sendImpl({
    url: webhook.url,
    body,
    signature,
    deliveryId,
    lookupFn: options?.lookupFn,
  });

  await prisma.alertWebhookDelivery.create({
    data: {
      // Same id as payload / X-Telemetry-Delivery so Recent deliveries match the POST.
      id: deliveryId,
      webhook_id: webhook.id,
      project_id: projectId,
      dedupe_key: dedupeKey,
      attempt: 1,
      // Single-shot test — FAILED (not DEAD) when the destination rejects.
      status: result.ok ? "SUCCESS" : "FAILED",
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

async function postWebhookOnceAsSendImpl(input: {
  url: string;
  body: string;
  signature: string | null;
  deliveryId: string;
  lookupFn?: WebhookDnsLookup;
}): Promise<WebhookSendResult> {
  return postWebhookOnce(input.url, input.body, input.signature, input.deliveryId, {
    lookupFn: input.lookupFn,
  });
}
