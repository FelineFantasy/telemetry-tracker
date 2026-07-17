export type AlertConditionType = "ERROR_COUNT";

export type AlertRuleDestinations = {
  email: boolean;
  webhookIds: string[];
};

export type ErrorCountCondition = {
  threshold: number;
  windowMinutes: number;
  environment: string | null;
};

export type AlertRuleRow = {
  id: string;
  name: string;
  enabled: boolean;
  conditionType: AlertConditionType;
  condition: ErrorCountCondition;
  destinations: AlertRuleDestinations;
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
  if (rule.conditionType === "ERROR_COUNT") {
    const env = rule.condition.environment
      ? ` in ${rule.condition.environment}`
      : "";
    return `≥ ${rule.condition.threshold} errors / ${rule.condition.windowMinutes}m${env}`;
  }
  return rule.conditionType;
}

function isDestinations(value: unknown): value is AlertRuleDestinations {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.email === "boolean" &&
    Array.isArray(o.webhookIds) &&
    o.webhookIds.every((id) => typeof id === "string")
  );
}

function isCondition(value: unknown): value is ErrorCountCondition {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.threshold === "number" &&
    typeof o.windowMinutes === "number" &&
    (o.environment === null || typeof o.environment === "string")
  );
}

export function isAlertRuleRow(value: unknown): value is AlertRuleRow {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.enabled === "boolean" &&
    o.conditionType === "ERROR_COUNT" &&
    isCondition(o.condition) &&
    isDestinations(o.destinations) &&
    typeof o.cooldownMinutes === "number" &&
    typeof o.createdAt === "string" &&
    typeof o.updatedAt === "string"
  );
}
