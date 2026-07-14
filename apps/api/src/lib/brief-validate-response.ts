import type { BriefSnapshotRequest, WorkspaceBriefResponse } from "./brief-contracts.js";
import { parseWorkspaceBriefResponse } from "./brief-contracts.js";
import {
  validateWorkspaceBriefResponseIntegrity,
  type BriefResponseIntegrityFailure,
} from "./brief-response-integrity.js";

export type PrivateBriefValidationFailure = "invalid_response" | BriefResponseIntegrityFailure;

export type PrivateBriefValidationResult =
  | { ok: true; data: WorkspaceBriefResponse }
  | { ok: false; code: PrivateBriefValidationFailure; message: string };

/**
 * Single validation path for AI and cache-hit responses.
 * Treats the private service as untrusted.
 */
export function validatePrivateBriefResponse(
  snapshot: BriefSnapshotRequest,
  raw: unknown
): PrivateBriefValidationResult {
  const parsed = parseWorkspaceBriefResponse(raw);
  if (!parsed.ok) {
    return { ok: false, code: "invalid_response", message: parsed.error };
  }

  const integrity = validateWorkspaceBriefResponseIntegrity(snapshot, parsed.data);
  if (!integrity.ok) {
    return {
      ok: false,
      code: integrity.code,
      message: integrity.message,
    };
  }

  return { ok: true, data: parsed.data };
}
