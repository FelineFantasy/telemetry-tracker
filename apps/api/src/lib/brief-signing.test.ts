import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  BRIEF_AI_WORKSPACE_PATH,
  BRIEF_SECRET_MIN_BYTES,
  BRIEF_SIGNING_VERSION,
} from "./brief-constants.js";
import {
  buildBriefSigningHeaders,
  buildBriefSigningPayload,
  decodeBriefServiceSecret,
  sha256HexRawBody,
  signBriefWorkspaceRequest,
  verifyBriefSignature,
} from "./brief-signing.js";

const SECRET = Buffer.alloc(BRIEF_SECRET_MIN_BYTES, 7);
const SECRET_B64 = SECRET.toString("base64");
const REQUEST_ID = "b0000000-0000-4000-8000-000000000003";
const CONTENT_HASH = "a".repeat(64);

describe("brief signing", () => {
  it("builds the canonical payload with raw body hash", () => {
    const rawBody = Buffer.from('{"requestId":"x"}', "utf8");
    const payload = buildBriefSigningPayload({
      timestampSec: 1_700_000_000,
      requestId: REQUEST_ID,
      method: "POST",
      path: BRIEF_AI_WORKSPACE_PATH,
      contentHash: CONTENT_HASH,
      rawBody,
    });
    expect(payload).toBe(
      [
        BRIEF_SIGNING_VERSION,
        "1700000000",
        REQUEST_ID,
        "POST",
        BRIEF_AI_WORKSPACE_PATH,
        CONTENT_HASH,
        sha256HexRawBody(rawBody),
      ].join("\n")
    );
  });

  it("does not include snapshotHash in the canonical payload", () => {
    const rawBody = Buffer.from("{}", "utf8");
    const payload = buildBriefSigningPayload({
      timestampSec: 1,
      requestId: REQUEST_ID,
      method: "POST",
      path: BRIEF_AI_WORKSPACE_PATH,
      contentHash: CONTENT_HASH,
      rawBody,
    });
    expect(payload.includes("snapshotHash")).toBe(false);
  });

  it("rejects secrets shorter than 32 decoded bytes without throwing", () => {
    const decoded = decodeBriefServiceSecret(SECRET_B64, { requireProductionLength: false });
    expect(decoded?.length).toBe(BRIEF_SECRET_MIN_BYTES);
    expect(
      decodeBriefServiceSecret(Buffer.alloc(8).toString("base64"), {
        requireProductionLength: true,
      })
    ).toBeNull();
  });

  it("signs and verifies request headers", () => {
    const rawBody = Buffer.from('{"hello":"world"}', "utf8");
    const headers = buildBriefSigningHeaders(SECRET, {
      timestampSec: 1_700_000_000,
      requestId: REQUEST_ID,
      contentHash: CONTENT_HASH,
      rawBody,
    });
    const expected = signBriefWorkspaceRequest(SECRET, {
      timestampSec: 1_700_000_000,
      requestId: REQUEST_ID,
      method: "POST",
      path: BRIEF_AI_WORKSPACE_PATH,
      contentHash: CONTENT_HASH,
      rawBody,
    });
    expect(headers["X-Telemetry-Signature"]).toBe(expected);
    expect(verifyBriefSignature(expected, headers["X-Telemetry-Signature"])).toBe(true);

    const payload = buildBriefSigningPayload({
      timestampSec: 1_700_000_000,
      requestId: REQUEST_ID,
      method: "POST",
      path: BRIEF_AI_WORKSPACE_PATH,
      contentHash: CONTENT_HASH,
      rawBody,
    });
    const manual = `${BRIEF_SIGNING_VERSION}=${createHmac("sha256", SECRET).update(payload).digest("hex")}`;
    expect(headers["X-Telemetry-Signature"]).toBe(manual);
  });

  it("detects tampered raw body signatures", () => {
    const rawBody = Buffer.from('{"a":1}', "utf8");
    const signature = signBriefWorkspaceRequest(SECRET, {
      timestampSec: 10,
      requestId: REQUEST_ID,
      method: "POST",
      path: BRIEF_AI_WORKSPACE_PATH,
      contentHash: CONTENT_HASH,
      rawBody,
    });
    const tampered = signBriefWorkspaceRequest(SECRET, {
      timestampSec: 10,
      requestId: REQUEST_ID,
      method: "POST",
      path: BRIEF_AI_WORKSPACE_PATH,
      contentHash: CONTENT_HASH,
      rawBody: Buffer.from('{"a":2}', "utf8"),
    });
    expect(verifyBriefSignature(signature, tampered)).toBe(false);
  });
});
