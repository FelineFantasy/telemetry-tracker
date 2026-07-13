export type LabsPreferences = {
  commandPalette: boolean;
};

export const DEFAULT_LABS_PREFERENCES: LabsPreferences = {
  commandPalette: false,
};

export function parseLabsPreferences(raw: unknown): LabsPreferences {
  if (typeof raw !== "object" || raw === null) {
    return DEFAULT_LABS_PREFERENCES;
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.commandPalette !== "boolean") {
    return DEFAULT_LABS_PREFERENCES;
  }
  return { commandPalette: o.commandPalette };
}

export function labsPreferencesEqual(a: LabsPreferences, b: LabsPreferences): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
