/**
 * Ingest-time PII scrubbing config and payload helpers.
 * Default: enabled. Self-hosters can disable with TELEMETRY_INGEST_PII_SCRUB=false.
 * Project denyKeys (Phase 2) merge into scrub options when provided.
 */

import {
  scrubPiiRecord,
  scrubPiiText,
  type PiiScrubOptions,
} from "./pii-scrub.js";

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Default on; set TELEMETRY_INGEST_PII_SCRUB=false|0|off to disable. */
export function isIngestPiiScrubEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const raw = env.TELEMETRY_INGEST_PII_SCRUB?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off" || raw === "no") {
    return false;
  }
  return true;
}

export function resolveIngestPiiScrubOptions(
  env: NodeJS.ProcessEnv = process.env,
  extras?: { denyKeys?: string[] }
): PiiScrubOptions {
  return {
    maxDepth: parsePositiveInt(env.TELEMETRY_INGEST_PII_SCRUB_MAX_DEPTH, 8),
    maxNodes: parsePositiveInt(env.TELEMETRY_INGEST_PII_SCRUB_MAX_NODES, 500),
    ...(extras?.denyKeys && extras.denyKeys.length > 0
      ? { denyKeys: extras.denyKeys }
      : {}),
  };
}

export type IngestErrorFields = {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
};

export type IngestEventFields = {
  properties?: Record<string, unknown>;
};

export type IngestScrubExtras = {
  denyKeys?: string[];
};

/** Scrub error message/stack/context before fingerprint + persistence. */
export function scrubIngestErrorFields<T extends IngestErrorFields>(
  body: T,
  env: NodeJS.ProcessEnv = process.env,
  extras?: IngestScrubExtras
): T {
  if (!isIngestPiiScrubEnabled(env)) return body;
  const options = resolveIngestPiiScrubOptions(env, extras);
  return {
    ...body,
    message: scrubPiiText(body.message),
    ...(body.stack !== undefined
      ? { stack: scrubPiiText(body.stack) }
      : {}),
    ...(body.context !== undefined
      ? { context: scrubPiiRecord(body.context, options) }
      : {}),
  };
}

/** Scrub event properties before persistence. */
export function scrubIngestEventFields<T extends IngestEventFields>(
  body: T,
  env: NodeJS.ProcessEnv = process.env,
  extras?: IngestScrubExtras
): T {
  if (!isIngestPiiScrubEnabled(env)) return body;
  if (body.properties === undefined) return body;
  const options = resolveIngestPiiScrubOptions(env, extras);
  return {
    ...body,
    properties: scrubPiiRecord(body.properties, options),
  };
}
