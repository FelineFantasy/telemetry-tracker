import { OrgRole } from "@prisma/client";
import { prisma } from "./db.js";

export async function getMembershipRoleForProject(
  userId: string,
  projectId: string
): Promise<OrgRole | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deleted_at: null },
    select: { organization_id: true },
  });
  if (!project) return null;
  const m = await prisma.organizationMembership.findFirst({
    where: { user_id: userId, organization_id: project.organization_id },
    select: { role: true },
  });
  return m?.role ?? null;
}

export function canResolveErrors(role: OrgRole | null): boolean {
  if (role === null) return false;
  return role === OrgRole.OWNER || role === OrgRole.EDITOR;
}

export function canCreateApiKey(role: OrgRole | null): boolean {
  if (role === null) return false;
  return role === OrgRole.OWNER || role === OrgRole.EDITOR;
}

export function canRevokeApiKey(role: OrgRole | null): boolean {
  return role === OrgRole.OWNER;
}

export function canManageOrganization(role: OrgRole | null): boolean {
  return role === OrgRole.OWNER;
}
