import { fetchDashboardNotifications } from "@/lib/dashboard-notifications";
import { getDashboardWorkspaceForRequest } from "@/lib/dashboard-workspace-request";
import { DashboardNotifications } from "./DashboardNotifications";

export async function DashboardNotificationsLoader() {
  const { effectiveProjectId, resolvedOrgId } = await getDashboardWorkspaceForRequest();

  const items = await fetchDashboardNotifications({
    projectIdOverride: effectiveProjectId === "" ? undefined : effectiveProjectId,
    organizationIdOverride: resolvedOrgId ?? undefined,
  });

  return <DashboardNotifications initialItems={items} />;
}
