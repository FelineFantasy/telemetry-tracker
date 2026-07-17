import { OrgRole } from "@prisma/client";
import { z } from "zod";

export type ProjectAlertEmailRole = "OWNER" | "EDITOR" | "VIEWER";

export type ProjectAlertEmailSettings = {
  /** When false, skip project alert / new-error email fan-out (webhooks still fire). */
  enabled: boolean;
  /** Org roles that receive project alert emails (default owners + editors). */
  roles: ProjectAlertEmailRole[];
  /**
   * Extra recipient addresses beyond role fan-out (max 10).
   * Registered users respect their notification preferences; unknown addresses
   * receive mail without per-user preference checks.
   */
  additionalEmails: string[];
};

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
  email: ProjectAlertEmailSettings;
};

export const DEFAULT_PROJECT_ALERT_EMAIL_SETTINGS: ProjectAlertEmailSettings = {
  enabled: true,
  roles: ["OWNER", "EDITOR"],
  additionalEmails: [],
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
  email: { ...DEFAULT_PROJECT_ALERT_EMAIL_SETTINGS },
};

const MAX_ADDITIONAL_EMAILS = 10;

const emailAddressSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254);

const emailSettingsSchema = z.object({
  enabled: z.boolean(),
  roles: z
    .array(z.enum(["OWNER", "EDITOR", "VIEWER"]))
    .min(1)
    .max(3)
    .refine((roles) => new Set(roles).size === roles.length, {
      message: "roles must be unique",
    }),
  additionalEmails: z
    .array(emailAddressSchema)
    .max(MAX_ADDITIONAL_EMAILS)
    .transform((emails) => [...new Set(emails)]),
});

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
  email: emailSettingsSchema.optional(),
});

function normalizeEmailSettings(
  raw: z.infer<typeof emailSettingsSchema> | undefined
): ProjectAlertEmailSettings {
  if (!raw) return { ...DEFAULT_PROJECT_ALERT_EMAIL_SETTINGS };
  return {
    enabled: raw.enabled,
    roles: raw.roles,
    additionalEmails: raw.additionalEmails,
  };
}

export function parseProjectAlertSettings(raw: unknown): ProjectAlertSettings {
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ...DEFAULT_PROJECT_ALERT_SETTINGS,
      email: { ...DEFAULT_PROJECT_ALERT_EMAIL_SETTINGS },
    };
  }
  return {
    errorSpike: parsed.data.errorSpike,
    quota: parsed.data.quota,
    email: normalizeEmailSettings(parsed.data.email),
  };
}

export function validateProjectAlertSettingsPatch(
  body: unknown
): { ok: true; settings: ProjectAlertSettings } | { ok: false; error: string } {
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Invalid alert settings payload" };
  }
  return {
    ok: true,
    settings: {
      errorSpike: parsed.data.errorSpike,
      quota: parsed.data.quota,
      email: normalizeEmailSettings(parsed.data.email),
    },
  };
}

export function alertEmailRolesToOrgRoles(
  roles: ProjectAlertEmailRole[]
): OrgRole[] {
  return roles.map((role) => {
    switch (role) {
      case "OWNER":
        return OrgRole.OWNER;
      case "EDITOR":
        return OrgRole.EDITOR;
      case "VIEWER":
        return OrgRole.VIEWER;
    }
  });
}

/** Bucket key so the same spike window fires at most once. */
export function errorSpikeDedupeKey(
  projectId: string,
  windowMinutes: number,
  now = Date.now()
): string {
  const bucketMs = windowMinutes * 60 * 1000;
  const bucket = Math.floor(now / bucketMs);
  return `alert:error_spike:${projectId}:${windowMinutes}:${bucket}`;
}
