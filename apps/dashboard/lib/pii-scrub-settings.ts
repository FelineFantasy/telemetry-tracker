export type ProjectPiiScrubSettings = {
  denyKeys: string[];
  scrubSessionUserEmail: boolean;
};

export const DEFAULT_PROJECT_PII_SCRUB_SETTINGS: ProjectPiiScrubSettings = {
  denyKeys: [],
  scrubSessionUserEmail: false,
};

export function parseDenyKeysInput(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatDenyKeysInput(keys: string[]): string {
  return keys.join("\n");
}

export function normalizeProjectPiiScrubSettings(
  raw: Partial<ProjectPiiScrubSettings> | null | undefined
): ProjectPiiScrubSettings {
  return {
    denyKeys: Array.isArray(raw?.denyKeys) ? raw.denyKeys : [],
    scrubSessionUserEmail: raw?.scrubSessionUserEmail === true,
  };
}

export function piiScrubSettingsEqual(
  a: ProjectPiiScrubSettings,
  b: ProjectPiiScrubSettings
): boolean {
  if (a.scrubSessionUserEmail !== b.scrubSessionUserEmail) return false;
  if (a.denyKeys.length !== b.denyKeys.length) return false;
  return a.denyKeys.every((k, i) => k === b.denyKeys[i]);
}
