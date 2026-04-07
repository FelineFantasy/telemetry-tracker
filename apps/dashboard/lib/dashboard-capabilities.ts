import { dashboardApiFetch } from "@/lib/dashboard-api";

export type DashboardSessionContext = {
  projectId: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  canResolveErrors: boolean;
  canCreateApiKey: boolean;
  canRevokeApiKey: boolean;
  canManageOrganization: boolean;
  canCreateProject: boolean;
};

/** Role and mutation flags for the active project (session + `X-Project-Id`). */
export async function getDashboardSessionContext(): Promise<DashboardSessionContext | null> {
  const res = await dashboardApiFetch("/api/meta/session-context");
  if (!res.ok) return null;
  const data = (await res.json()) as DashboardSessionContext;
  if (
    typeof data.role !== "string" ||
    typeof data.canResolveErrors !== "boolean" ||
    typeof data.canCreateApiKey !== "boolean" ||
    typeof data.canRevokeApiKey !== "boolean" ||
    typeof data.canManageOrganization !== "boolean" ||
    typeof data.canCreateProject !== "boolean"
  ) {
    return null;
  }
  return data;
}
