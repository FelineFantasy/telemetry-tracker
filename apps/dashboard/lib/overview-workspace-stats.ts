import type { OverviewWorkspaceStats } from "@/lib/overview-api";
import { formatOrganizationRailName } from "@/lib/workspace-placeholders";

export function buildOverviewWorkspaceStats(
  organizations: { id: string; name: string }[],
  projects: { organizationId: string }[],
  resolvedOrgId: string | null
): OverviewWorkspaceStats {
  const orgProjects = resolvedOrgId
    ? projects.filter((p) => p.organizationId === resolvedOrgId)
    : projects;

  const names = organizations
    .slice(0, 3)
    .map((o) => formatOrganizationRailName(o.name));
  const detail =
    names.length === 0
      ? "—"
      : names.join(", ") + (organizations.length > 3 ? ` +${organizations.length - 3} more` : "");

  return {
    projects: {
      count: orgProjects.length,
      detail: resolvedOrgId ? "in selected organization" : "across workspace",
    },
    organizations: {
      count: organizations.length,
      detail,
    },
  };
}
