import { z } from "zod";

/** Project-level PII scrub extensions (deny-list keys). Server defaults still apply. */
export type ProjectPiiScrubSettings = {
  /**
   * Extra property/context keys to redact on ingest (case-insensitive).
   * Values become `[redacted]` unless the key already has a built-in placeholder.
   */
  denyKeys: string[];
};

export const DEFAULT_PROJECT_PII_SCRUB_SETTINGS: ProjectPiiScrubSettings = {
  denyKeys: [],
};

const MAX_DENY_KEYS = 50;
const MAX_KEY_LEN = 64;

const settingsSchema = z.object({
  denyKeys: z
    .array(z.string().trim().min(1).max(MAX_KEY_LEN))
    .max(MAX_DENY_KEYS)
    .default([]),
});

function normalizeDenyKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of keys) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const norm = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(trimmed.slice(0, MAX_KEY_LEN));
  }
  return out;
}

export function parseProjectPiiScrubSettings(raw: unknown): ProjectPiiScrubSettings {
  const parsed = settingsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return DEFAULT_PROJECT_PII_SCRUB_SETTINGS;
  }
  return { denyKeys: normalizeDenyKeys(parsed.data.denyKeys) };
}

export function validateProjectPiiScrubSettingsPatch(
  body: unknown
): { ok: true; settings: ProjectPiiScrubSettings } | { ok: false; error: string } {
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid PII scrub settings (denyKeys: up to ${MAX_DENY_KEYS} strings, each ≤ ${MAX_KEY_LEN} chars)`,
    };
  }
  return { ok: true, settings: { denyKeys: normalizeDenyKeys(parsed.data.denyKeys) } };
}
