import { dashboardApiFetch } from "@/lib/dashboard-api";

export type UsageQuotaInfo = {
  planTier: string;
  monthlyIngestUsed: number;
  monthlyIngestLimit: number;
  percentUsed: number;
  nearQuota: boolean;
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
  return {
    planTier: o.planTier,
    monthlyIngestUsed: o.monthlyIngestUsed,
    monthlyIngestLimit: o.monthlyIngestLimit,
    percentUsed: o.percentUsed,
    nearQuota: o.nearQuota,
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
  };
}
