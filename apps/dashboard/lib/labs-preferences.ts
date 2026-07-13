import { dashboardApiFetch } from "@/lib/dashboard-api";
import {
  DEFAULT_LABS_PREFERENCES,
  parseLabsPreferences,
  type LabsPreferences,
} from "@/lib/labs-preferences-shared";

export type { LabsPreferences } from "@/lib/labs-preferences-shared";

export {
  DEFAULT_LABS_PREFERENCES,
  labsPreferencesEqual,
  parseLabsPreferences,
} from "@/lib/labs-preferences-shared";

export async function fetchLabsPreferences(): Promise<LabsPreferences> {
  const res = await dashboardApiFetch("/api/meta/labs-preferences");
  if (!res.ok) return DEFAULT_LABS_PREFERENCES;
  try {
    const data = (await res.json()) as { preferences?: unknown };
    return parseLabsPreferences(data.preferences);
  } catch {
    return DEFAULT_LABS_PREFERENCES;
  }
}
