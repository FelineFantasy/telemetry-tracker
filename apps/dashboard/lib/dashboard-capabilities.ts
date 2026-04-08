import { dashboardApiFetch } from "@/lib/dashboard-api";

export type DashboardSessionContext = {
  projectId: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  canResolveErrors: boolean;
  canCreateApiKey: boolean;
  canRevokeApiKey: boolean;
  canCreateProject: boolean;
  /** Invite/change members (org owner only; same gate as API). */
  canManageMembers: boolean;
};

/** Role and mutation flags: project-scoped fields follow `X-Project-Id`; org-scoped fields follow `X-Organization-Id` when set. */
export async function getDashboardSessionContext(): Promise<DashboardSessionContext | null> {
  const res = await dashboardApiFetch("/api/meta/session-context");
  if (!res.ok) return null;
  const data = (await res.json()) as DashboardSessionContext;
  if (
    typeof data.role !== "string" ||
    typeof data.canResolveErrors !== "boolean" ||
    typeof data.canCreateApiKey !== "boolean" ||
    typeof data.canRevokeApiKey !== "boolean" ||
    typeof data.canCreateProject !== "boolean" ||
    typeof data.canManageMembers !== "boolean"
  ) {
    return null;
  }
  return data;
}
