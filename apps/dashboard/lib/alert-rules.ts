/** Opaque destination id for project alert email (Notifications resolves delivery). */
export const PROJECT_EMAIL_DESTINATION_ID = "project-email";

export type AlertConditionType = "ERROR_COUNT";

export type ErrorCountCondition = {
  type: "ERROR_COUNT";
  threshold: number;
  windowMinutes: number;
  environment: string | null;
};

export type AlertRuleCondition = ErrorCountCondition;

export type AlertRuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  /** AND of conditions. */
  conditions: AlertRuleCondition[];
  /** Opaque destination ids resolved by Notifications. */
  destinationIds: string[];
  cooldownMinutes: number;
  createdAt: string;
  updatedAt: string;
};

export function conditionTypeLabel(type: AlertConditionType): string {
  switch (type) {
    case "ERROR_COUNT":
      return "Error count";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export function formatAlertRuleSummary(rule: AlertRuleRow): string {
  if (rule.conditions.length === 0) {
    // API returns [] when stored conditions fail validation; rule still exists
    // and must remain visible so editors can disable/remove it.
    return "Invalid or unsupported conditions";
  }
  return rule.conditions
    .map((c) => {
      if (c.type === "ERROR_COUNT") {
        const env = c.environment ? ` in ${c.environment}` : "";
        return `≥ ${c.threshold} errors / ${c.windowMinutes}m${env}`;
      }
      return c.type;
    })
    .join(" AND ");
}

function isCondition(value: unknown): value is AlertRuleCondition {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    o.type === "ERROR_COUNT" &&
    typeof o.threshold === "number" &&
    typeof o.windowMinutes === "number" &&
    (o.environment === null || typeof o.environment === "string")
  );
}

export function isAlertRuleRow(value: unknown): value is AlertRuleRow {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  // Empty conditions are allowed: API `toPublic` maps unparsable stored JSON to
  // [] (evaluation skips those rules). Editors must still see/remove them.
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.enabled === "boolean" &&
    Array.isArray(o.conditions) &&
    o.conditions.every(isCondition) &&
    Array.isArray(o.destinationIds) &&
    o.destinationIds.every((id) => typeof id === "string") &&
    typeof o.cooldownMinutes === "number" &&
    typeof o.createdAt === "string" &&
    typeof o.updatedAt === "string"
  );
}
