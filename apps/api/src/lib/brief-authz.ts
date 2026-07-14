import type { PrismaClient } from "@prisma/client";
import { getMembershipRoleForOrganization } from "./org-permissions.js";
import type { ServedBriefMeta } from "./brief-served-meta.js";

export type BriefAuthorizedProject = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
};

export type BriefAuthzResult =
  | {
      ok: true;
      organizationId: string;
      organizationName: string;
      projects: BriefAuthorizedProject[];
    }
  | { ok: false; code: "forbidden" | "no_projects" };

export async function authorizeWorkspaceBrief(
  prisma: PrismaClient,
  userId: string,
  organizationId: string
): Promise<BriefAuthzResult> {
  const role = await getMembershipRoleForOrganization(userId, organizationId);
  if (!role) {
    return { ok: false, code: "forbidden" };
  }

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, deleted_at: null },
    select: { id: true, name: true },
  });
  if (!organization) {
    return { ok: false, code: "forbidden" };
  }

  const projects = await prisma.project.findMany({
    where: {
      organization_id: organizationId,
      deleted_at: null,
      organization: { deleted_at: null },
    },
    select: { id: true, name: true, slug: true, created_at: true },
    orderBy: { name: "asc" },
  });

  if (projects.length === 0) {
    return { ok: false, code: "no_projects" };
  }

  return {
    ok: true,
    organizationId: organization.id,
    organizationName: organization.name,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      createdAt: p.created_at,
    })),
  };
}

export type BriefAckAuthzErrorCode =
  | "stale_brief"
  | "ack_timestamp_mismatch"
  | "project_not_in_served_brief"
  | "forbidden";

export function authorizeBriefAck(
  meta: ServedBriefMeta | null,
  organizationId: string,
  projects: Array<{ projectId: string; acknowledgedThrough: string }>
): { ok: true } | { ok: false; code: BriefAckAuthzErrorCode } {
  if (!meta || meta.organizationId !== organizationId) {
    return { ok: false, code: "stale_brief" };
  }

  if (meta.source === "fallback") {
    return { ok: false, code: "stale_brief" };
  }

  const metaByProject = new Map(meta.projects.map((p) => [p.projectId, p.generatedThrough]));

  for (const project of projects) {
    const expected = metaByProject.get(project.projectId);
    if (!expected) {
      return { ok: false, code: "project_not_in_served_brief" };
    }
    if (project.acknowledgedThrough !== expected) {
      return { ok: false, code: "ack_timestamp_mismatch" };
    }
  }

  return { ok: true };
}
