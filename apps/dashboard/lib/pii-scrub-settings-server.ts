import "server-only";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import {
  DEFAULT_PROJECT_PII_SCRUB_SETTINGS,
  normalizeProjectPiiScrubSettings,
  type ProjectPiiScrubSettings,
} from "@/lib/pii-scrub-settings";

export type FetchProjectPiiScrubSettingsResult =
  | { ok: true; settings: ProjectPiiScrubSettings }
  | { ok: false; error: string };

/**
 * Load project PII scrub settings.
 * On failure, returns `{ ok: false }` — callers must not treat defaults as
 * authoritative (saving empty denyKeys would wipe stored keys).
 */
export async function fetchProjectPiiScrubSettings(): Promise<FetchProjectPiiScrubSettingsResult> {
  try {
    const res = await dashboardApiFetch("/api/project/pii-scrub-settings");
    if (!res.ok) {
      return {
        ok: false,
        error: `Could not load PII scrub settings (${res.status})`,
      };
    }
    const data = (await res.json()) as { settings?: ProjectPiiScrubSettings };
    return {
      ok: true,
      settings: normalizeProjectPiiScrubSettings(data.settings),
    };
  } catch {
    return {
      ok: false,
      error: "Could not load PII scrub settings",
    };
  }
}

/** Display placeholder only — never persist without a successful load. */
export function piiScrubSettingsLoadFallback(): ProjectPiiScrubSettings {
  return DEFAULT_PROJECT_PII_SCRUB_SETTINGS;
}
