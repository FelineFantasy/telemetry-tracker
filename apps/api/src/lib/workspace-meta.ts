import type { PrismaClient } from "@prisma/client";
import {
  distinctAppsForProject,
  distinctEnvironmentsForProject,
} from "./project-scope-labels.js";

export type WorkspaceOrganizationRow = { id: string; name: string };

export type WorkspaceProjectRow = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
};

export type WorkspaceMetaPayload = {
  organizations: WorkspaceOrganizationRow[];
  projects: WorkspaceProjectRow[];
  forbiddenOrg?: boolean;
};

export type NavScopePayload = {
  apps: string[];
  environments: string[];
};

/**
 * One membership query + one project query (replaces separate /meta/organizations and /meta/projects).
 */
export async function loadWorkspaceMetaForUser(
  prisma: PrismaClient,
  userId: string,
  headerOrg?: string | null
): Promise<WorkspaceMetaPayload> {
  const rows = await prisma.organizationMembership.findMany({
    where: { user_id: userId, organization: { deleted_at: null } },
    select: {
      organization_id: true,
      organization: { select: { id: true, name: true } },
    },
    orderBy: { created_at: "asc" },
  });

  const organizations = rows.map((row) => ({
    id: row.organization.id,
    name: row.organization.name,
  }));

  const orgIds = [...new Set(rows.map((row) => row.organization_id))];
  if (orgIds.length === 0) {
    return { organizations: [], projects: [] };
  }

  let filterIds = orgIds;
  if (headerOrg) {
    if (!orgIds.includes(headerOrg)) {
      return { organizations, projects: [], forbiddenOrg: true };
    }
    filterIds = [headerOrg];
  }

  const projects = await prisma.project.findMany({
    where: {
      organization_id: { in: filterIds },
      deleted_at: null,
      organization: { deleted_at: null },
    },
    select: { id: true, name: true, slug: true, organization_id: true },
    orderBy: { name: "asc" },
  });

  return {
    organizations,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      organizationId: project.organization_id,
    })),
  };
}

export async function loadNavScopeForProject(
  prisma: PrismaClient,
  projectId: string,
  app?: string
): Promise<NavScopePayload> {
  const [apps, environments] = await Promise.all([
    distinctAppsForProject(prisma, projectId),
    distinctEnvironmentsForProject(prisma, projectId, app),
  ]);
  return { apps, environments };
}
