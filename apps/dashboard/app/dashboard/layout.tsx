import { cookies } from "next/headers";
import { DashboardShell } from "@/app/components/dashboard/DashboardShell";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { getDashboardSessionContext } from "@/lib/dashboard-capabilities";
import {
  getDashboardOrganizationId,
  resolveActiveOrganizationId,
} from "@/lib/dashboard-org";
import {
  TELEMETRY_PROJECT_COOKIE,
  getDashboardProjectId,
} from "@/lib/dashboard-project";
import { getDashboardUser } from "@/lib/dashboard-user";

const PROJECT_COOKIE_OPTS = {
  path: "/" as const,
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 400,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

async function getAppsForProject(
  projectId: string,
  organizationId: string | null
): Promise<string[]> {
  const res = await dashboardApiFetch("/api/apps", undefined, {
    projectIdOverride: projectId,
    ...(organizationId
      ? { organizationIdOverride: organizationId }
      : {}),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.apps) ? data.apps : [];
}

type OrgRow = { id: string; name: string };

async function getOrganizations(): Promise<OrgRow[]> {
  const res = await dashboardApiFetch("/api/meta/organizations", undefined, {
    omitOrganizationHeader: true,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { organizations?: OrgRow[] };
  return Array.isArray(data.organizations) ? data.organizations : [];
}

type ProjectRow = { id: string; name: string; slug: string; organizationId: string };

async function getProjects(): Promise<ProjectRow[]> {
  const res = await dashboardApiFetch("/api/meta/projects", undefined, {
    omitOrganizationHeader: true,
  });
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
  const [cookieOrgId, currentProjectId] = await Promise.all([
    getDashboardOrganizationId(),
    getDashboardProjectId(),
  ]);

  const [organizations, allProjects, user] = await Promise.all([
    getOrganizations(),
    getProjects(),
    getDashboardUser(),
  ]);

  const resolvedOrgId = resolveActiveOrganizationId(cookieOrgId, organizations);

  const projects =
    resolvedOrgId !== null
      ? allProjects.filter(
          (p) => p.organizationId.toLowerCase() === resolvedOrgId.toLowerCase(),
        )
      : allProjects;

  /** Project cookie can still point at another org after switching workspace — align before `/api/apps`. */
  let effectiveProjectId: string;
  if (projects.length === 0) {
    effectiveProjectId =
      resolvedOrgId !== null ? "" : currentProjectId;
  } else if (
    projects.some((p) => p.id.toLowerCase() === currentProjectId.toLowerCase())
  ) {
    effectiveProjectId = currentProjectId;
  } else {
    effectiveProjectId = projects[0]!.id;
    const c = await cookies();
    c.set(TELEMETRY_PROJECT_COOKIE, effectiveProjectId.toLowerCase(), PROJECT_COOKIE_OPTS);
  }

  const [apps, capabilities] = await Promise.all([
    effectiveProjectId === ""
      ? Promise.resolve([] as string[])
      : getAppsForProject(effectiveProjectId, resolvedOrgId),
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
