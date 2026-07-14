/**
 * Workspace brief request signing (public → private).
 *
 * Canonical payload (newline-separated):
 *   version, timestamp, requestId, method, path, contentHash, sha256(rawBody)
 *
 * The signature covers the exact raw request bytes. Do not parse or reserialize
 * JSON before verification. `snapshotHash` is intentionally excluded — the full
 * snapshot body is already bound by sha256(rawBody).
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  BRIEF_AI_WORKSPACE_PATH,
  BRIEF_SECRET_MIN_BYTES,
  BRIEF_SIGNING_VERSION,
} from "./brief-constants.js";

export type BriefSigningInput = {
  timestampSec: number;
  requestId: string;
  method: string;
  path: string;
  contentHash: string;
  rawBody: Buffer | Uint8Array;
};

export type BriefSigningHeaders = {
  "X-Telemetry-Timestamp": string;
  "X-Telemetry-Request-Id": string;
  "X-Telemetry-Content-Hash": string;
  "X-Telemetry-Signature": string;
};

/** SHA-256 hex digest of the exact request body bytes. */
export function sha256HexRawBody(rawBody: Buffer | Uint8Array): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

/** Build the newline-separated canonical signing string. */
export function buildBriefSigningPayload(input: BriefSigningInput): string {
  const bodyHash = sha256HexRawBody(input.rawBody);
  return [
    BRIEF_SIGNING_VERSION,
    String(input.timestampSec),
    input.requestId,
    input.method,
    input.path,
    input.contentHash,
    bodyHash,
  ].join("\n");
}

/** Decode a base64 shared secret; rejects secrets shorter than 32 decoded bytes in production. */
export function decodeBriefServiceSecret(
  encoded: string | undefined,
  options?: { requireProductionLength?: boolean }
): Buffer | null {
  if (!encoded || encoded.trim() === "") return null;
  let decoded: Buffer;
  try {
    decoded = Buffer.from(encoded.trim(), "base64");
  } catch {
    return null;
  }
  const requireLength = options?.requireProductionLength ?? process.env.NODE_ENV === "production";
  if (requireLength && decoded.length < BRIEF_SECRET_MIN_BYTES) {
    throw new Error(
      `TELEMETRY_AI_BRIEF_SECRET must decode to at least ${BRIEF_SECRET_MIN_BYTES} bytes`
    );
  }
  return decoded;
}

/** Compute `v1={hex}` HMAC-SHA256 signature for a workspace brief request. */
export function signBriefWorkspaceRequest(
  secret: Buffer,
  input: BriefSigningInput
): string {
  const payload = buildBriefSigningPayload(input);
  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  return `${BRIEF_SIGNING_VERSION}=${digest}`;
}

/** Constant-time signature comparison. */
export function verifyBriefSignature(
  expected: string,
  actual: string
): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Headers for POST /v1/briefs/workspace using the raw JSON body bytes. */
export function buildBriefSigningHeaders(
  secret: Buffer,
  input: Omit<BriefSigningInput, "method" | "path"> & {
    method?: string;
    path?: string;
  }
): BriefSigningHeaders {
  const signingInput: BriefSigningInput = {
    timestampSec: input.timestampSec,
    requestId: input.requestId,
    method: input.method ?? "POST",
    path: input.path ?? BRIEF_AI_WORKSPACE_PATH,
    contentHash: input.contentHash,
    rawBody: input.rawBody,
  };
  return {
    "X-Telemetry-Timestamp": String(signingInput.timestampSec),
    "X-Telemetry-Request-Id": signingInput.requestId,
    "X-Telemetry-Content-Hash": signingInput.contentHash,
    "X-Telemetry-Signature": signBriefWorkspaceRequest(secret, signingInput),
  };
}
