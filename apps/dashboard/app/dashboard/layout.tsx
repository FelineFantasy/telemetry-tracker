import { DashboardShell } from "@/app/components/dashboard/DashboardShell";
import { getDashboardSessionContext } from "@/lib/dashboard-capabilities";
import {
  fetchDashboardAppsList,
  getDashboardWorkspaceForRequest,
} from "@/lib/dashboard-workspace-request";
import { getDashboardUser } from "@/lib/dashboard-user";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [workspace, user] = await Promise.all([
    getDashboardWorkspaceForRequest(),
    getDashboardUser(),
  ]);

  const { organizations, projects, resolvedOrgId, effectiveProjectId } = workspace;

  const [apps, capabilities] = await Promise.all([
    effectiveProjectId === ""
      ? Promise.resolve([] as string[])
      : fetchDashboardAppsList(effectiveProjectId, resolvedOrgId),
    getDashboardSessionContext(
      effectiveProjectId === "" ? null : effectiveProjectId,
      resolvedOrgId
    ),
  ]);

  return (
    <DashboardShell
      apps={apps}
      organizations={organizations}
      currentOrganizationId={resolvedOrgId}
      projects={projects}
      currentProjectId={effectiveProjectId}
      user={user}
      capabilities={capabilities}
    >
      {children}
    </DashboardShell>
  );
}
