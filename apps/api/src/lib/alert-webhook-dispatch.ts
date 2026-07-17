import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import https from "node:https";
import { isIP } from "node:net";
import {
  Prisma,
  type AlertRuleType,
  type AlertWebhookDeliveryStatus,
  type AlertWebhookProvider,
  type PrismaClient,
} from "@prisma/client";
import {
  buildAlertDeliveryBody,
  parseAlertWebhookProvider,
  parseTelegramWebhookConfig,
  providerUsesSigningSecret,
  validateProviderWebhookUrl,
  type AlertChannelPayloadInput,
} from "./alert-webhook-channel-payload.js";
import { dashboardOriginOrNull } from "./dashboard-origin.js";

const WEBHOOK_CAP_TX = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 5000,
  timeout: 15000,
} as const;
const WEBHOOK_CAP_TX_RETRIES = 5;

function isPrismaTransactionConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2034"
  );
}

export const MAX_PROJECT_WEBHOOKS = 5;
export const WEBHOOK_MAX_ATTEMPTS = 2;
export const WEBHOOK_RETRY_DELAY_MS = 500;
export const WEBHOOK_FETCH_TIMEOUT_MS = 8_000;
/** Bound delivery-time DNS so a hung resolver cannot outlive the claim lease. */
export const WEBHOOK_DNS_TIMEOUT_MS = 5_000;
/** Extra lease headroom beyond DNS+POST so reclaim cannot race a slow response. */
export const WEBHOOK_LEASE_POST_MARGIN_MS = 5_000;
export const WEBHOOK_WORKER_LEASE_MS_DEFAULT = 30_000;
export const WEBHOOK_WORKER_POLL_MS_DEFAULT = 1_000;

/** Minimum claim/renew lease: DNS budget + HTTPS POST timeout + margin. */
export function webhookDeliveryLeaseMinimumMs(): number {
  return WEBHOOK_DNS_TIMEOUT_MS + WEBHOOK_FETCH_TIMEOUT_MS + WEBHOOK_LEASE_POST_MARGIN_MS;
}

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
  provider: AlertWebhookProvider;
  /** Non-secret provider config (e.g. Telegram chat id). */
  config: { chatId?: string } | null;
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

/**
 * Lease duration for claim/renew. Always at least
 * {@link webhookDeliveryLeaseMinimumMs} (DNS timeout + POST timeout + margin)
 * so a short env override cannot expire the lease while delivery-time DNS or
 * HTTPS POST is still in flight (which would let another worker reclaim and
 * duplicate the delivery).
 */
export function resolveAlertWebhookWorkerLeaseMs(
  env: NodeJS.ProcessEnv = process.env
): number {
  const raw = env.ALERT_WEBHOOK_WORKER_LEASE_MS;
  let leaseMs = WEBHOOK_WORKER_LEASE_MS_DEFAULT;
  if (raw !== undefined && raw.trim() !== "") {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      leaseMs = parsed;
    }
  }
  return Math.max(leaseMs, webhookDeliveryLeaseMinimumMs());
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

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Resolve hostname and reject if any address is private/loopback/link-local.
 * Closes the DNS-rebinding gap left by create-time hostname string checks alone.
 * Lookup is bounded by {@link WEBHOOK_DNS_TIMEOUT_MS} so a hung resolver cannot
 * outlive the worker claim lease (lease minimum includes this budget).
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
    const results = await withTimeout(
      lookupFn(host),
      WEBHOOK_DNS_TIMEOUT_MS,
      "DNS lookup timed out"
    );
    if (results.length === 0) {
      return { ok: false, error: "Webhook URL host could not be resolved" };
    }
    for (const { address } of results) {
      if (isBlockedIpAddress(address)) {
        return { ok: false, error: "Webhook URL host is not allowed" };
      }
    }
    return { ok: true, addresses: results };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "";
    if (message === "DNS lookup timed out") {
      return { ok: false, error: "Webhook URL host DNS lookup timed out" };
    }
    return { ok: false, error: "Webhook URL host could not be resolved" };
  }
}

/** Prefer IPv4 when both families are present (validated already). */
export function pickPinnedWebhookAddress(addresses: WebhookDnsAddress[]): WebhookDnsAddress {
  return addresses.find((a) => a.family === 4) ?? addresses[0]!;
}

/**
 * Custom `https.request` / `net.connect` `lookup` that returns a pre-validated IP
 * without calling system DNS again (closes DNS-rebinding TOCTOU).
 *
 * Node 24+ often invokes lookup with `{ all: true }` and expects
 * `callback(null, LookupAddress[])`. Older call sites use the single-address form
 * `callback(null, address, family)`. Both must be handled or deliveries fail with
 * `Invalid IP address: undefined`.
 */
export function createPinnedWebhookLookup(pinned: WebhookDnsAddress): (
  hostname: string,
  options: unknown,
  callback?: (
    err: NodeJS.ErrnoException | null,
    address: string | Array<{ address: string; family: number }>,
    family?: number
  ) => void
) => void {
  return (_hostname, options, callback) => {
    const cb =
      typeof options === "function"
        ? (options as NonNullable<typeof callback>)
        : callback;
    if (!cb) return;

    const all =
      typeof options === "object" &&
      options !== null &&
      (options as { all?: boolean }).all === true;

    if (all) {
      cb(null, [{ address: pinned.address, family: pinned.family }]);
      return;
    }
    cb(null, pinned.address, pinned.family);
  };
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
  provider: AlertWebhookProvider;
  config: Prisma.JsonValue | null;
  enabled: boolean;
  signing_secret: string | null;
  created_at: Date;
  updated_at: Date;
}): ProjectWebhookPublic {
  let config: { chatId?: string } | null = null;
  if (row.provider === "TELEGRAM" && row.config && typeof row.config === "object" && !Array.isArray(row.config)) {
    const chatId = (row.config as { chatId?: unknown }).chatId;
    if (typeof chatId === "string" || typeof chatId === "number") {
      config = { chatId: String(chatId) };
    }
  }
  return {
    id: row.id,
    urlMasked: maskWebhookUrl(row.url),
    label: row.label,
    provider: row.provider,
    config,
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
  provider?: unknown;
  /** Telegram: `{ chatId }`. Ignored for other providers. */
  config?: unknown;
};

function resolveCreateProviderAndConfig(input: CreateWebhookInput):
  | {
      ok: true;
      provider: AlertWebhookProvider;
      config: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    }
  | { ok: false; error: string } {
  const provider = parseAlertWebhookProvider(input.provider ?? "GENERIC");
  if (!provider) {
    return { ok: false, error: "Webhook provider is invalid" };
  }
  if (provider === "TELEGRAM") {
    const parsed = parseTelegramWebhookConfig(input.config ?? {});
    if (!parsed.ok) return parsed;
    return { ok: true, provider, config: parsed.config };
  }
  return { ok: true, provider, config: Prisma.JsonNull };
}

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

  const providerResolved = resolveCreateProviderAndConfig(input);
  if (!providerResolved.ok) {
    return { ok: false, error: providerResolved.error, status: 400 };
  }

  const providerCheck = validateProviderWebhookUrl(
    providerResolved.provider,
    validated.url
  );
  if (!providerCheck.ok) {
    return { ok: false, error: providerCheck.error, status: 400 };
  }

  const label =
    typeof input.label === "string" && input.label.trim().length > 0
      ? input.label.trim().slice(0, 80)
      : null;

  const wantsSigning =
    input.withSigningSecret === true
      ? true
      : input.withSigningSecret === false
        ? false
        : providerUsesSigningSecret(providerResolved.provider);
  const signingSecret = wantsSigning ? generateWebhookSigningSecret() : null;

  // Count + insert under serializable isolation so concurrent creates cannot exceed the cap.
  for (let attempt = 0; attempt < WEBHOOK_CAP_TX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const count = await tx.projectWebhook.count({
          where: { project_id: projectId, deleted_at: null },
        });
        if (count >= MAX_PROJECT_WEBHOOKS) {
          return {
            ok: false as const,
            error: `At most ${MAX_PROJECT_WEBHOOKS} webhooks per project`,
            status: 409 as const,
          };
        }

        const row = await tx.projectWebhook.create({
          data: {
            id: randomUUID(),
            project_id: projectId,
            url: validated.url,
            provider: providerResolved.provider,
            config: providerResolved.config,
            label,
            enabled: input.enabled !== false,
            signing_secret: signingSecret,
          },
        });

        return {
          ok: true as const,
          webhook: toProjectWebhookPublic(row),
          signingSecret,
        };
      }, WEBHOOK_CAP_TX);
    } catch (e) {
      const retry =
        isPrismaTransactionConflict(e) && attempt < WEBHOOK_CAP_TX_RETRIES - 1;
      if (!retry) throw e;
    }
  }

  throw new Error("createProjectWebhook: exhausted serializable retries");
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
    config?: unknown;
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
    const providerCheck = validateProviderWebhookUrl(existing.provider, validated.url);
    if (!providerCheck.ok) {
      return { ok: false, error: providerCheck.error, status: 400 };
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

  let nextConfig: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
  if (patch.config !== undefined) {
    if (existing.provider === "TELEGRAM") {
      const parsed = parseTelegramWebhookConfig(patch.config);
      if (!parsed.ok) {
        return { ok: false, error: parsed.error, status: 400 };
      }
      nextConfig = parsed.config;
    } else {
      nextConfig = Prisma.JsonNull;
    }
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
      ...(nextConfig !== undefined ? { config: nextConfig } : {}),
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
  const { pruneWebhookIdFromAlertRules } = await import("./alert-rules.js");
  await pruneWebhookIdFromAlertRules(prisma, projectId, webhookId);
  return { ok: true };
}

export type EnqueueAlertWebhookInput = {
  projectId: string;
  alertEventId: string;
  dedupeKey: string;
  /**
   * When set, only these webhook ids (must still be enabled + belonging to project).
   * Empty array skips webhook fan-out. When omitted, all enabled project webhooks.
   */
  webhookIds?: string[];
};

/**
 * Persist PENDING delivery rows for each enabled webhook.
 * Must complete before fireProjectAlert returns (durable enqueue).
 */
export async function enqueueAlertWebhookDeliveries(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: EnqueueAlertWebhookInput
): Promise<number> {
  if (input.webhookIds !== undefined && input.webhookIds.length === 0) {
    return 0;
  }
  const webhooks = await prisma.projectWebhook.findMany({
    where: {
      project_id: input.projectId,
      deleted_at: null,
      enabled: true,
      ...(input.webhookIds !== undefined
        ? { id: { in: input.webhookIds } }
        : {}),
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

/** Cap Telegram Bot API response body reads (ok/description JSON is small). */
const TELEGRAM_RESPONSE_BODY_MAX_BYTES = 8_192;

/**
 * Telegram Bot API often returns HTTP 200 with `{ "ok": false, … }` for delivery
 * failures (bad chat id, bot blocked, etc.). Treat only `ok: true` as success.
 */
export function interpretTelegramBotApiResponse(
  httpStatus: number,
  bodyText: string
): WebhookSendResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return {
      ok: false,
      httpStatus,
      error: "Telegram API response was not valid JSON",
    };
  }
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    !("ok" in parsed) ||
    typeof (parsed as { ok: unknown }).ok !== "boolean"
  ) {
    return {
      ok: false,
      httpStatus,
      error: "Telegram API response missing boolean ok field",
    };
  }
  if ((parsed as { ok: boolean }).ok === true) {
    return { ok: true, httpStatus };
  }
  const description =
    "description" in parsed && typeof (parsed as { description: unknown }).description === "string"
      ? (parsed as { description: string }).description.trim()
      : "";
  const errorCode =
    "error_code" in parsed && typeof (parsed as { error_code: unknown }).error_code === "number"
      ? (parsed as { error_code: number }).error_code
      : null;
  const detail = description
    ? errorCode != null
      ? `Telegram API error ${errorCode}: ${description}`
      : `Telegram API error: ${description}`
    : "Telegram API returned ok: false";
  return { ok: false, httpStatus, error: detail.slice(0, 400) };
}

function readResponseBodyLimited(
  res: NodeJS.ReadableStream,
  maxBytes: number
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const finish = (result: { ok: true; text: string } | { ok: false; error: string }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    res.on("data", (chunk: Buffer | string) => {
      if (settled) return;
      const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      size += buf.length;
      if (size > maxBytes) {
        res.removeAllListeners("data");
        res.resume();
        finish({ ok: false, error: "Telegram API response body too large" });
        return;
      }
      chunks.push(buf);
    });
    res.on("end", () => {
      finish({ ok: true, text: Buffer.concat(chunks).toString("utf8") });
    });
    res.on("error", (e: unknown) => {
      finish({
        ok: false,
        error: e instanceof Error ? e.message : "Failed to read response body",
      });
    });
  });
}

/**
 * POST over HTTPS while pinning the TCP connect to a pre-validated IP.
 * Uses custom `lookup` so Node never re-resolves (closes DNS rebinding TOCTOU).
 * Redirects are not followed (`https.request` does not auto-follow).
 * Telegram (`api.telegram.org`) responses are parsed for Bot API `{ ok }` JSON.
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
  const isTelegramHost = parsed.hostname.toLowerCase() === "api.telegram.org";

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
        // Must handle Node 24+ `{ all: true }` (array callback) and single-address form.
        lookup: createPinnedWebhookLookup(pinned),
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({
            ok: false,
            httpStatus: status,
            error: `HTTP ${status} (redirect not followed)`,
          });
          return;
        }
        if (status >= 200 && status < 300) {
          if (!isTelegramHost) {
            res.resume();
            resolve({ ok: true, httpStatus: status });
            return;
          }
          void readResponseBodyLimited(res, TELEGRAM_RESPONSE_BODY_MAX_BYTES).then((read) => {
            if (!read.ok) {
              resolve({ ok: false, httpStatus: status, error: read.error.slice(0, 400) });
              return;
            }
            resolve(interpretTelegramBotApiResponse(status, read.text));
          });
          return;
        }
        res.resume();
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

const TEST_WEBHOOK_FINALIZE_ATTEMPTS = 3;

/**
 * Write a terminal status for a test delivery. Retries transient DB failures.
 * Test rows are excluded from worker reclaim (`webhook:test:%`), so leaving
 * PROCESSING would show "Sending" forever in the UI.
 *
 * @returns true when the intended status was written; false if only a FAILED
 *   last-resort write succeeded (or nothing could be written).
 */
export async function finalizeTestWebhookDelivery(
  prisma: PrismaClient,
  deliveryId: string,
  data: {
    status: "SUCCESS" | "FAILED";
    http_status: number | null;
    error: string | null;
  }
): Promise<boolean> {
  const clearLease = {
    lease_owner: null as null,
    lease_expires_at: null as null,
  };

  for (let attempt = 0; attempt < TEST_WEBHOOK_FINALIZE_ATTEMPTS; attempt++) {
    try {
      await prisma.alertWebhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: data.status,
          http_status: data.http_status,
          error: data.error,
          ...clearLease,
        },
      });
      return true;
    } catch {
      // Transient DB error — retry before falling back.
    }
  }

  // Absolute last resort — any terminal state beats stuck PROCESSING.
  try {
    await prisma.alertWebhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: "FAILED",
        http_status: data.http_status,
        error: (data.error ?? "Could not finalize delivery status").slice(0, 400),
        ...clearLease,
      },
    });
    return data.status === "FAILED";
  } catch {
    return false;
  }
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
  const channelInput: AlertChannelPayloadInput = {
    deliveryId,
    projectId,
    rule: "ERROR_SPIKE",
    title: "Test webhook from Telemetry Tracker",
    body: "This is a sample alert.fired payload so you can verify your endpoint.",
    href: "/dashboard/alerts",
    dedupeKey,
  };
  const payload = buildAlertWebhookPayload(channelInput);
  const genericBody = JSON.stringify(payload);
  const deliveryBody = buildAlertDeliveryBody(
    webhook.provider,
    channelInput,
    genericBody,
    webhook.config
  );
  if (!deliveryBody.ok) {
    return { ok: false, error: deliveryBody.error, status: 502 };
  }
  const body = deliveryBody.body;
  const signature =
    webhook.signing_secret && providerUsesSigningSecret(webhook.provider)
      ? signWebhookBody(body, webhook.signing_secret)
      : null;

  // Persist before POST (create failure must not leave an unlogged destination hit).
  // PROCESSING + lease mirrors worker ownership for the in-flight request; claim SQL
  // excludes webhook:test:% so an expired lease cannot be reclaimed for a duplicate POST.
  const leaseOwner = `test-webhook:${deliveryId}`;
  const leaseMs = resolveAlertWebhookWorkerLeaseMs();
  await prisma.alertWebhookDelivery.create({
    data: {
      // Same id as payload / X-Telemetry-Delivery so Recent deliveries match the POST.
      id: deliveryId,
      webhook_id: webhook.id,
      project_id: projectId,
      dedupe_key: dedupeKey,
      attempt: 1,
      status: "PROCESSING",
      lease_owner: leaseOwner,
      lease_expires_at: new Date(Date.now() + leaseMs),
      http_status: null,
      error: null,
    },
  });

  const sendImpl = options?.sendImpl ?? postWebhookOnceAsSendImpl;
  let result: WebhookSendResult;
  try {
    result = await sendImpl({
      url: webhook.url,
      body,
      signature,
      deliveryId,
      lookupFn: options?.lookupFn,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message.slice(0, 400) : "Request failed";
    result = { ok: false, httpStatus: null, error: message };
  }

  // Single-shot test — FAILED (not DEAD) when the destination rejects.
  // Always terminalize: worker will not reclaim webhook:test:% rows.
  const finalized = await finalizeTestWebhookDelivery(prisma, deliveryId, {
    status: result.ok ? "SUCCESS" : "FAILED",
    http_status: result.httpStatus,
    error: result.ok ? null : result.error,
  });
  if (!finalized) {
    return {
      ok: false,
      error: "Could not finalize delivery status",
      status: 502,
      httpStatus: result.httpStatus,
    };
  }

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
