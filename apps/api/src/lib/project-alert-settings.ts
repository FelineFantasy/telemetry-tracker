import { z } from "zod";

export type ProjectAlertSettings = {
  errorSpike: {
    enabled: boolean;
    /** Minimum error occurrences in the window to fire. */
    threshold: number;
    windowMinutes: number;
  };
  quota: {
    enabled: boolean;
    /** Percent of monthly ingest limit (1–99). */
    nearPercent: number;
  };
};

export const DEFAULT_PROJECT_ALERT_SETTINGS: ProjectAlertSettings = {
  errorSpike: {
    enabled: true,
    threshold: 25,
    windowMinutes: 15,
  },
  quota: {
    enabled: true,
    nearPercent: 90,
  },
};

const settingsSchema = z.object({
  errorSpike: z.object({
    enabled: z.boolean(),
    threshold: z.number().int().min(1).max(10_000),
    windowMinutes: z.number().int().min(5).max(24 * 60),
  }),
  quota: z.object({
    enabled: z.boolean(),
    nearPercent: z.number().int().min(50).max(99),
  }),
});

export function parseProjectAlertSettings(raw: unknown): ProjectAlertSettings {
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    return DEFAULT_PROJECT_ALERT_SETTINGS;
  }
  return parsed.data;
}

export function validateProjectAlertSettingsPatch(
  body: unknown
): { ok: true; settings: ProjectAlertSettings } | { ok: false; error: string } {
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Invalid alert settings payload" };
  }
  return { ok: true, settings: parsed.data };
}

/** Bucket key so the same spike window fires at most once. */
export function errorSpikeDedupeKey(projectId: string, windowMinutes: number, now = Date.now()): string {
  const bucketMs = windowMinutes * 60 * 1000;
  const bucket = Math.floor(now / bucketMs);
  return `alert:error_spike:${projectId}:${windowMinutes}:${bucket}`;
}
