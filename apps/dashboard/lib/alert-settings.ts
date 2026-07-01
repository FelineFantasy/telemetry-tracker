export type ProjectAlertSettings = {
  errorSpike: {
    enabled: boolean;
    threshold: number;
    windowMinutes: number;
  };
  quota: {
    enabled: boolean;
    nearPercent: number;
  };
};

export type AlertEventRow = {
  id: string;
  rule: "ERROR_SPIKE" | "QUOTA_NEAR" | "QUOTA_EXCEEDED";
  title: string;
  body: string;
  firedAt: string;
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

function isSettings(value: unknown): value is ProjectAlertSettings {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  const es = o.errorSpike;
  const q = o.quota;
  if (typeof es !== "object" || es === null || typeof q !== "object" || q === null) {
    return false;
  }
  const spike = es as Record<string, unknown>;
  const quota = q as Record<string, unknown>;
  return (
    typeof spike.enabled === "boolean" &&
    typeof spike.threshold === "number" &&
    typeof spike.windowMinutes === "number" &&
    typeof quota.enabled === "boolean" &&
    typeof quota.nearPercent === "number"
  );
}

export function parseProjectAlertSettings(raw: unknown): ProjectAlertSettings {
  return isSettings(raw) ? raw : DEFAULT_PROJECT_ALERT_SETTINGS;
}

export function alertSettingsEqual(a: ProjectAlertSettings, b: ProjectAlertSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function ruleLabel(rule: AlertEventRow["rule"]): string {
  switch (rule) {
    case "ERROR_SPIKE":
      return "Error spike";
    case "QUOTA_NEAR":
      return "Quota warning";
    case "QUOTA_EXCEEDED":
      return "Quota exceeded";
    default:
      return rule;
  }
}
