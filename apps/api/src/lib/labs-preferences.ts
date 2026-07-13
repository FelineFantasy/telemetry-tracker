import { z } from "zod";

export type LabsPreferences = {
  commandPalette: boolean;
};

export const DEFAULT_LABS_PREFERENCES: LabsPreferences = {
  commandPalette: false,
};

const preferencesSchema = z.object({
  commandPalette: z.boolean(),
});

export function parseLabsPreferences(raw: unknown): LabsPreferences {
  const parsed = preferencesSchema.safeParse(raw);
  if (!parsed.success) {
    return DEFAULT_LABS_PREFERENCES;
  }
  return parsed.data;
}

export function validateLabsPreferencesPatch(
  body: unknown
): { ok: true; preferences: LabsPreferences } | { ok: false; error: string } {
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Invalid labs preferences payload" };
  }
  return { ok: true, preferences: parsed.data };
}

export function labsPreferencesEqual(a: LabsPreferences, b: LabsPreferences): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
