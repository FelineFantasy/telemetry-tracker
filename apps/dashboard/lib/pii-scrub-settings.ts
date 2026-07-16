export type ProjectPiiScrubSettings = {
  denyKeys: string[];
};

export const DEFAULT_PROJECT_PII_SCRUB_SETTINGS: ProjectPiiScrubSettings = {
  denyKeys: [],
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

export function piiScrubSettingsEqual(
  a: ProjectPiiScrubSettings,
  b: ProjectPiiScrubSettings
): boolean {
  if (a.denyKeys.length !== b.denyKeys.length) return false;
  return a.denyKeys.every((k, i) => k === b.denyKeys[i]);
}
