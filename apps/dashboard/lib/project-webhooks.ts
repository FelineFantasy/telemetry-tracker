import { dashboardApiFetch } from "@/lib/dashboard-api";

export type AlertWebhookProvider =
  | "GENERIC"
  | "SLACK"
  | "DISCORD"
  | "MICROSOFT_TEAMS"
  | "TELEGRAM";

export type ProjectWebhookRow = {
  id: string;
  urlMasked: string;
  label: string | null;
  provider: AlertWebhookProvider;
  config: { chatId?: string } | null;
  enabled: boolean;
  hasSigningSecret: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AlertWebhookDeliveryRow = {
  id: string;
  webhookId: string;
  webhookLabel: string | null;
  webhookUrlMasked: string;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "DEAD";
  attempt: number;
  httpStatus: number | null;
  error: string | null;
  createdAt: string;
};

const PROVIDERS = new Set<string>([
  "GENERIC",
  "SLACK",
  "DISCORD",
  "MICROSOFT_TEAMS",
  "TELEGRAM",
]);

export async function fetchProjectWebhooks(): Promise<ProjectWebhookRow[]> {
  const res = await dashboardApiFetch("/api/project/webhooks");
  if (!res.ok) return [];
  try {
    const data = (await res.json()) as { webhooks?: unknown };
    if (!Array.isArray(data.webhooks)) return [];
    return data.webhooks.filter(isWebhookRow);
  } catch {
    return [];
  }
}

export async function fetchProjectWebhookDeliveries(
  limit = 25
): Promise<AlertWebhookDeliveryRow[]> {
  const res = await dashboardApiFetch(
    `/api/project/webhook-deliveries?limit=${encodeURIComponent(String(limit))}`
  );
  if (!res.ok) return [];
  try {
    const data = (await res.json()) as { deliveries?: unknown };
    if (!Array.isArray(data.deliveries)) return [];
    return data.deliveries.filter(isDeliveryRow);
  } catch {
    return [];
  }
}

function isWebhookRow(value: unknown): value is ProjectWebhookRow {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.urlMasked !== "string" ||
    (o.label !== null && typeof o.label !== "string") ||
    typeof o.enabled !== "boolean" ||
    typeof o.hasSigningSecret !== "boolean" ||
    typeof o.createdAt !== "string" ||
    typeof o.updatedAt !== "string"
  ) {
    return false;
  }
  // Older API responses without provider are treated as generic HTTPS webhooks.
  const provider =
    typeof o.provider === "string" && PROVIDERS.has(o.provider)
      ? (o.provider as AlertWebhookProvider)
      : "GENERIC";
  o.provider = provider;
  if (o.config === undefined || o.config === null) {
    o.config = null;
  } else if (typeof o.config === "object" && !Array.isArray(o.config)) {
    const chatId = (o.config as { chatId?: unknown }).chatId;
    o.config =
      typeof chatId === "string" || typeof chatId === "number"
        ? { chatId: String(chatId) }
        : null;
  } else {
    return false;
  }
  return true;
}

function isDeliveryRow(value: unknown): value is AlertWebhookDeliveryRow {
  if (typeof value !== "object" || value === null) return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.webhookId === "string" &&
    (o.webhookLabel === null || typeof o.webhookLabel === "string") &&
    typeof o.webhookUrlMasked === "string" &&
    (o.status === "PENDING" ||
      o.status === "PROCESSING" ||
      o.status === "SUCCESS" ||
      o.status === "FAILED" ||
      o.status === "DEAD") &&
    typeof o.attempt === "number" &&
    (o.httpStatus === null || typeof o.httpStatus === "number") &&
    (o.error === null || typeof o.error === "string") &&
    typeof o.createdAt === "string"
  );
}
