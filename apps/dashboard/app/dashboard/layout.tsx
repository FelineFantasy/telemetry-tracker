import { DashboardShell } from "@/app/components/dashboard/DashboardShell";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { getDashboardProjectId } from "@/lib/dashboard-project";

async function getApps(): Promise<string[]> {
  const res = await dashboardApiFetch("/api/apps");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.apps) ? data.apps : [];
}

type ProjectRow = { id: string; name: string; slug: string };

async function getProjects(): Promise<ProjectRow[]> {
  const res = await dashboardApiFetch("/api/meta/projects");
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.projects) ? data.projects : [];
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [apps, projects, currentProjectId] = await Promise.all([
    getApps(),
    getProjects(),
    getDashboardProjectId(),
  ]);

  return (
    <DashboardShell
      apps={apps}
      projects={projects}
      currentProjectId={currentProjectId}
    >
      {children}
    </DashboardShell>
  );
}
