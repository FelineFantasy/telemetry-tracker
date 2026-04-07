import { DashboardShell } from "@/app/components/dashboard/DashboardShell";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { getDashboardSessionContext } from "@/lib/dashboard-capabilities";
import { getDashboardOrganizationId } from "@/lib/dashboard-org";
import { getDashboardProjectId } from "@/lib/dashboard-project";
import { getDashboardUser } from "@/lib/dashboard-user";

async function getApps(): Promise<string[]> {
  const res = await dashboardApiFetch("/api/apps");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.apps) ? data.apps : [];
}

type OrgRow = { id: string; name: string };

async function getOrganizations(): Promise<OrgRow[]> {
  const res = await dashboardApiFetch("/api/meta/organizations");
  if (!res.ok) return [];
  const data = await res.json() as { organizations?: OrgRow[] };
  return Array.isArray(data.organizations) ? data.organizations : [];
}

type ProjectRow = { id: string; name: string; slug: string; organizationId: string };

async function getProjects(): Promise<ProjectRow[]> {
  const res = await dashboardApiFetch("/api/meta/projects");
  if (!res.ok) return [];
  const data = await res.json();
  const raw = Array.isArray(data.projects) ? data.projects : [];
  return raw.map((p: { id: string; name: string; slug: string; organizationId?: string }) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    organizationId: p.organizationId ?? "",
  }));
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [
    apps,
    organizations,
    allProjects,
    cookieOrgId,
    currentProjectId,
    user,
    capabilities,
  ] = await Promise.all([
    getApps(),
    getOrganizations(),
    getProjects(),
    getDashboardOrganizationId(),
    getDashboardProjectId(),
    getDashboardUser(),
    getDashboardSessionContext(),
  ]);

  const orgIdSet = new Set(organizations.map((o) => o.id));
  const resolvedOrgId =
    cookieOrgId && orgIdSet.has(cookieOrgId)
      ? cookieOrgId
      : organizations[0]?.id ?? null;

  const projects =
    resolvedOrgId !== null
      ? allProjects.filter((p) => p.organizationId === resolvedOrgId)
      : allProjects;

  return (
    <DashboardShell
      apps={apps}
      organizations={organizations}
      currentOrganizationId={resolvedOrgId}
      projects={projects}
      currentProjectId={currentProjectId}
      user={user}
      capabilities={capabilities}
    >
      {children}
    </DashboardShell>
  );
}
