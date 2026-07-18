/** Opaque destination id for project alert email (Notifications resolves delivery). */
export const PROJECT_EMAIL_DESTINATION_ID = "project-email";

/** Mirrors API `MAX_CONDITIONS_PER_RULE`. */
export const MAX_ALERT_RULE_CONDITIONS = 8;

export const MAX_ALERT_RULE_NAME_LENGTH = 120;
export const MIN_ALERT_COOLDOWN_MINUTES = 5;
export const MAX_ALERT_COOLDOWN_MINUTES = 24 * 60;
export const MIN_ERROR_COUNT_THRESHOLD = 1;
export const MAX_ERROR_COUNT_THRESHOLD = 10_000;
export const MIN_ERROR_COUNT_WINDOW_MINUTES = 5;
export const MAX_ERROR_COUNT_WINDOW_MINUTES = 24 * 60;

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

/** Client draft for create / edit forms (environment is a free-text field). */
export type AlertRuleConditionDraft = {
  /** Stable React key — not sent to the API. */
  key: string;
  type: "ERROR_COUNT";
  threshold: number;
  windowMinutes: number;
  environment: string;
};

export type AlertRuleFormDraft = {
  name: string;
  conditions: AlertRuleConditionDraft[];
  destinationIds: string[];
  cooldownMinutes: number;
};

export type AlertRulePayload = {
  name: string;
  conditions: AlertRuleCondition[];
  destinationIds: string[];
  cooldownMinutes: number;
};

export type AlertRuleDraftValidation =
  | { ok: true; payload: AlertRulePayload }
  | { ok: false; error: string };

export type DestinationOption = {
  id: string;
  label: string;
  /** Short channel kind for display (Email, Slack, …). */
  kind: string;
  enabled: boolean;
};

let draftKeySeq = 0;

function nextDraftKey(): string {
  draftKeySeq += 1;
  return `cond-${draftKeySeq}`;
}

export function createEmptyErrorCountCondition(
  overrides?: Partial<Omit<AlertRuleConditionDraft, "type" | "key">>
): AlertRuleConditionDraft {
  return {
    key: nextDraftKey(),
    type: "ERROR_COUNT",
    threshold: overrides?.threshold ?? 25,
    windowMinutes: overrides?.windowMinutes ?? 15,
    environment: overrides?.environment ?? "",
  };
}

export function createDefaultAlertRuleDraft(): AlertRuleFormDraft {
  return {
    name: "",
    conditions: [createEmptyErrorCountCondition()],
    destinationIds: [PROJECT_EMAIL_DESTINATION_ID],
    cooldownMinutes: 15,
  };
}

export function draftFromAlertRule(rule: AlertRuleRow): AlertRuleFormDraft {
  // Preserve empty conditions as-is. API `toPublic` maps unparsable stored JSON
  // to []; do not synthesize a default ERROR_COUNT — that would let an edit that
  // only changes name/cooldown/destinations persist thresholds and re-arm the rule.
  const conditions = rule.conditions.map((c) =>
    createEmptyErrorCountCondition({
      threshold: c.threshold,
      windowMinutes: c.windowMinutes,
      environment: c.environment ?? "",
    })
  );
  return {
    name: rule.name,
    conditions,
    destinationIds: [...rule.destinationIds],
    cooldownMinutes: rule.cooldownMinutes,
  };
}

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

/** Human-readable destination bindings for rule list rows. */
export function formatAlertRuleDestinations(
  destinationIds: string[],
  options: DestinationOption[]
): string {
  if (destinationIds.length === 0) return "no destinations";
  const byId = new Map(options.map((o) => [o.id, o]));
  const parts: string[] = [];
  let missing = 0;
  for (const id of destinationIds) {
    if (id === PROJECT_EMAIL_DESTINATION_ID) {
      parts.push("project email");
      continue;
    }
    const opt = byId.get(id);
    if (!opt) {
      missing += 1;
      continue;
    }
    const status = opt.enabled ? "" : " (disabled)";
    parts.push(`${opt.kind}${status}`);
  }
  if (missing > 0) {
    parts.push(
      `${missing} missing binding${missing === 1 ? "" : "s"}`
    );
  }
  return parts.length > 0 ? parts.join(" · ") : "no destinations";
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/**
 * Validate a create/edit draft against API limits.
 * Requires ≥1 condition, ≥1 destination, and in-range numeric fields.
 */
export function validateAlertRuleDraft(
  draft: AlertRuleFormDraft
): AlertRuleDraftValidation {
  const name = draft.name.trim();
  if (!name) {
    return { ok: false, error: "Name is required" };
  }
  if (name.length > MAX_ALERT_RULE_NAME_LENGTH) {
    return {
      ok: false,
      error: `Name must be at most ${MAX_ALERT_RULE_NAME_LENGTH} characters`,
    };
  }
  if (draft.conditions.length === 0) {
    return { ok: false, error: "Add at least one condition" };
  }
  if (draft.conditions.length > MAX_ALERT_RULE_CONDITIONS) {
    return {
      ok: false,
      error: `At most ${MAX_ALERT_RULE_CONDITIONS} conditions per rule`,
    };
  }
  if (draft.destinationIds.length === 0) {
    return {
      ok: false,
      error: "Select at least one destination (email or a Delivery channel)",
    };
  }

  const conditions: AlertRuleCondition[] = [];
  for (let i = 0; i < draft.conditions.length; i++) {
    const c = draft.conditions[i]!;
    if (c.type !== "ERROR_COUNT") {
      return { ok: false, error: `Unsupported condition type at #${i + 1}` };
    }
    const threshold = clampInt(
      c.threshold,
      MIN_ERROR_COUNT_THRESHOLD,
      MAX_ERROR_COUNT_THRESHOLD
    );
    const windowMinutes = clampInt(
      c.windowMinutes,
      MIN_ERROR_COUNT_WINDOW_MINUTES,
      MAX_ERROR_COUNT_WINDOW_MINUTES
    );
    if (c.threshold !== threshold || c.windowMinutes !== windowMinutes) {
      return {
        ok: false,
        error: `Condition #${i + 1}: threshold must be ${MIN_ERROR_COUNT_THRESHOLD}–${MAX_ERROR_COUNT_THRESHOLD} and window ${MIN_ERROR_COUNT_WINDOW_MINUTES}–${MAX_ERROR_COUNT_WINDOW_MINUTES} minutes`,
      };
    }
    const env = c.environment.trim();
    if (env.length > 64) {
      return {
        ok: false,
        error: `Condition #${i + 1}: environment must be at most 64 characters`,
      };
    }
    conditions.push({
      type: "ERROR_COUNT",
      threshold,
      windowMinutes,
      environment: env.length > 0 ? env : null,
    });
  }

  const cooldownMinutes = clampInt(
    draft.cooldownMinutes,
    MIN_ALERT_COOLDOWN_MINUTES,
    MAX_ALERT_COOLDOWN_MINUTES
  );
  if (draft.cooldownMinutes !== cooldownMinutes) {
    return {
      ok: false,
      error: `Cooldown must be ${MIN_ALERT_COOLDOWN_MINUTES}–${MAX_ALERT_COOLDOWN_MINUTES} minutes`,
    };
  }

  const destinationIds = [...new Set(draft.destinationIds)];
  return {
    ok: true,
    payload: {
      name,
      conditions,
      destinationIds,
      cooldownMinutes,
    },
  };
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
