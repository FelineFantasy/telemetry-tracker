import { z } from "zod";

/** Project-level PII scrub extensions. Server defaults still apply. */
export type ProjectPiiScrubSettings = {
  /**
   * Extra property/context keys to redact on ingest (case-insensitive).
   * Values become `[redacted]` unless the key already has a built-in placeholder.
   */
  denyKeys: string[];
  /**
   * When true, scrub `Session.user_email` on ingest.
   * Non-empty values are stored as the placeholder `[email]` (not null).
   * Default false — session identity remains searchable until explicitly enabled.
   */
  scrubSessionUserEmail: boolean;
};

export const DEFAULT_PROJECT_PII_SCRUB_SETTINGS: ProjectPiiScrubSettings = {
  denyKeys: [],
  scrubSessionUserEmail: false,
};

const MAX_DENY_KEYS = 50;
const MAX_KEY_LEN = 64;

const storedSettingsSchema = z.object({
  denyKeys: z
    .array(z.string().trim().min(1).max(MAX_KEY_LEN))
    .max(MAX_DENY_KEYS)
    .default([]),
  scrubSessionUserEmail: z.boolean().default(false),
});

/** Partial PATCH body — omitted fields keep their previous values. */
const patchSchema = z
  .object({
    denyKeys: z
      .array(z.string().trim().min(1).max(MAX_KEY_LEN))
      .max(MAX_DENY_KEYS)
      .optional(),
    scrubSessionUserEmail: z.boolean().optional(),
  })
  .refine(
    (body) =>
      body.denyKeys !== undefined || body.scrubSessionUserEmail !== undefined,
    { message: "At least one of denyKeys or scrubSessionUserEmail is required" }
  );

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
  const parsed = storedSettingsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return DEFAULT_PROJECT_PII_SCRUB_SETTINGS;
  }
  return {
    denyKeys: normalizeDenyKeys(parsed.data.denyKeys),
    scrubSessionUserEmail: parsed.data.scrubSessionUserEmail,
  };
}

export function validateProjectPiiScrubSettingsPatch(
  body: unknown,
  previous: ProjectPiiScrubSettings = DEFAULT_PROJECT_PII_SCRUB_SETTINGS
): { ok: true; settings: ProjectPiiScrubSettings } | { ok: false; error: string } {
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid PII scrub settings (denyKeys: up to ${MAX_DENY_KEYS} strings, each ≤ ${MAX_KEY_LEN} chars; scrubSessionUserEmail: boolean; at least one field required)`,
    };
  }
  return {
    ok: true,
    settings: {
      denyKeys:
        parsed.data.denyKeys !== undefined
          ? normalizeDenyKeys(parsed.data.denyKeys)
          : previous.denyKeys,
      scrubSessionUserEmail:
        parsed.data.scrubSessionUserEmail !== undefined
          ? parsed.data.scrubSessionUserEmail
          : previous.scrubSessionUserEmail,
    },
  };
}

/** Compact audit target — counts only, not deny-key names. */
export function formatPiiScrubSettingsAuditTarget(
  projectId: string,
  settings: ProjectPiiScrubSettings
): string {
  return `project:${projectId} denyKeys=${settings.denyKeys.length} scrubSessionUserEmail=${settings.scrubSessionUserEmail}`;
}
