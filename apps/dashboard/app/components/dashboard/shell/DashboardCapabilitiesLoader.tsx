import { getDashboardSessionContext } from "@/lib/dashboard-capabilities";
import { dashboardDebug } from "@/lib/dashboard-debug";
import {
  getDashboardWorkspaceForRequest,
} from "@/lib/dashboard-workspace-request";
import { DashboardCapabilitiesHydrate } from "./DashboardCapabilitiesHydrate";

export async function DashboardCapabilitiesLoader() {
  const started = Date.now();
  const { effectiveProjectId, resolvedOrgId } = await getDashboardWorkspaceForRequest();
  const capabilities = await getDashboardSessionContext(
    effectiveProjectId === "" ? null : effectiveProjectId,
    resolvedOrgId
  );
  dashboardDebug("capabilities", "session context loaded", {
    ms: Date.now() - started,
    hasCapabilities: capabilities !== null,
  });
  return <DashboardCapabilitiesHydrate capabilities={capabilities} />;
}
