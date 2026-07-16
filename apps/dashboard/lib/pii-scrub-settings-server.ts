import "server-only";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import {
  DEFAULT_PROJECT_PII_SCRUB_SETTINGS,
  normalizeProjectPiiScrubSettings,
  type ProjectPiiScrubSettings,
} from "@/lib/pii-scrub-settings";

export async function fetchProjectPiiScrubSettings(): Promise<ProjectPiiScrubSettings> {
  const res = await dashboardApiFetch("/api/project/pii-scrub-settings");
  if (!res.ok) return DEFAULT_PROJECT_PII_SCRUB_SETTINGS;
  const data = (await res.json()) as { settings?: ProjectPiiScrubSettings };
  return normalizeProjectPiiScrubSettings(data.settings);
}
