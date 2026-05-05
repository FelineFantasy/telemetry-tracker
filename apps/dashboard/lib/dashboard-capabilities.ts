import { dashboardApiFetch } from "@/lib/dashboard-api";

export type UsageQuotaInfo = {
  planTier: string;
  monthlyIngestUsed: number;
  monthlyIngestLimit: number;
  percentUsed: number;
  quotaExceeded: boolean;
  nearQuota: boolean;
};

export type BillingHealthInfo = {
  stripeSubscriptionStatus: string | null;
  stripeCurrentPeriodEnd: string | null;
  storedPlanTier: string;
  effectivePlanTier: string;
  billingAlertVariant:
    | "past_due"
    | "unpaid"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | null;
};

export type DashboardSessionContext = {
  projectId: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  canResolveErrors: boolean;
  canCreateApiKey: boolean;
  canRevokeApiKey: boolean;
  canCreateProject: boolean;
  /** Invite/change members (org owner only; same gate as API). */
  canManageMembers: boolean;
  /** Present when the API could resolve plan + usage for the active project. */
  usageQuota: UsageQuotaInfo | null;
  /** Stripe subscription fields for the active project’s org; null if unknown. */
  billingHealth: BillingHealthInfo | null;
};

/** If shape is wrong (e.g. API mismatch), omit the banner rather than failing the whole session. */
function parseUsageQuota(uq: unknown): UsageQuotaInfo | null {
  if (uq == null) return null;
  if (typeof uq !== "object" || uq === null) return null;
  const o = uq as Record<string, unknown>;
  if (
    typeof o.planTier !== "string" ||
    typeof o.monthlyIngestUsed !== "number" ||
    typeof o.monthlyIngestLimit !== "number" ||
    typeof o.percentUsed !== "number" ||
    typeof o.nearQuota !== "boolean"
  ) {
    return null;
  }
  const limit = o.monthlyIngestLimit;
  const used = o.monthlyIngestUsed;
  const quotaExceeded =
    typeof o.quotaExceeded === "boolean"
      ? o.quotaExceeded
      : limit > 0 && used >= limit;
  return {
    planTier: o.planTier,
    monthlyIngestUsed: used,
    monthlyIngestLimit: limit,
    percentUsed: o.percentUsed,
    quotaExceeded,
    nearQuota: o.nearQuota,
  };
}

function parseBillingHealth(bh: unknown): BillingHealthInfo | null {
  if (bh == null) return null;
  if (typeof bh !== "object" || bh === null) return null;
  const o = bh as Record<string, unknown>;
  const variant = o.billingAlertVariant;
  const okVariant =
    variant === null ||
    variant === "past_due" ||
    variant === "unpaid" ||
    variant === "canceled" ||
    variant === "incomplete" ||
    variant === "incomplete_expired";
  if (
    typeof o.storedPlanTier !== "string" ||
    typeof o.effectivePlanTier !== "string" ||
    (typeof o.stripeSubscriptionStatus !== "string" && o.stripeSubscriptionStatus !== null) ||
    (typeof o.stripeCurrentPeriodEnd !== "string" && o.stripeCurrentPeriodEnd !== null) ||
    !okVariant
  ) {
    return null;
  }
  return {
    stripeSubscriptionStatus:
      o.stripeSubscriptionStatus === null ? null : (o.stripeSubscriptionStatus as string),
    stripeCurrentPeriodEnd:
      o.stripeCurrentPeriodEnd === null ? null : (o.stripeCurrentPeriodEnd as string),
    storedPlanTier: o.storedPlanTier,
    effectivePlanTier: o.effectivePlanTier,
    billingAlertVariant: variant as BillingHealthInfo["billingAlertVariant"],
  };
}

/** Role and mutation flags: project-scoped fields follow `X-Project-Id`; org-scoped fields follow `X-Organization-Id` when set. */
export async function getDashboardSessionContext(): Promise<DashboardSessionContext | null> {
  const res = await dashboardApiFetch("/api/meta/session-context");
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, unknown>;
  if (
    typeof data.role !== "string" ||
    typeof data.canResolveErrors !== "boolean" ||
    typeof data.canCreateApiKey !== "boolean" ||
    typeof data.canRevokeApiKey !== "boolean" ||
    typeof data.canCreateProject !== "boolean" ||
    typeof data.canManageMembers !== "boolean" ||
    typeof data.projectId !== "string"
  ) {
    return null;
  }
  return {
    projectId: data.projectId,
    role: data.role as DashboardSessionContext["role"],
    canResolveErrors: data.canResolveErrors,
    canCreateApiKey: data.canCreateApiKey,
    canRevokeApiKey: data.canRevokeApiKey,
    canCreateProject: data.canCreateProject,
    canManageMembers: data.canManageMembers,
    usageQuota: parseUsageQuota(data.usageQuota),
    billingHealth: parseBillingHealth(data.billingHealth),
  };
}
