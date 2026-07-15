/**
 * Organization-scoped brief snapshot building.
 *
 * Invariant: worker and async read-path identity use organizationId only.
 * No userId, session, viewer permissions, or per-user acknowledgement windows.
 */

import type { PrismaClient } from "@prisma/client";
import {
  buildWorkspaceBriefSnapshot,
  type BuildWorkspaceBriefSnapshotResult,
} from "./brief-snapshot.js";

export type OrganizationBriefProject = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
};

export type OrganizationBriefContext =
  | {
      ok: true;
      organizationId: string;
      organizationName: string;
      projects: OrganizationBriefProject[];
    }
  | { ok: false; code: "not_found" | "no_projects" };

export async function loadOrganizationBriefContext(
  prisma: PrismaClient,
  organizationId: string
): Promise<OrganizationBriefContext> {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, deleted_at: null },
    select: { id: true, name: true },
  });
  if (!organization) {
    return { ok: false, code: "not_found" };
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
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      createdAt: project.created_at,
    })),
  };
}

export type BuildOrganizationBriefSnapshotInput = {
  organizationId: string;
  requestId: string;
  requestUntil: Date;
};

/**
 * Build a snapshot for async identity and worker generation.
 * Uses all organization projects with acknowledgement-free windows.
 */
export async function buildOrganizationBriefSnapshot(
  prisma: PrismaClient,
  input: BuildOrganizationBriefSnapshotInput
): Promise<BuildWorkspaceBriefSnapshotResult> {
  const context = await loadOrganizationBriefContext(prisma, input.organizationId);
  if (!context.ok) {
    if (context.code === "no_projects") {
      return { ok: false, code: "no_projects" };
    }
    return { ok: false, code: "invalid_snapshot", error: "Organization not found" };
  }

  return buildWorkspaceBriefSnapshot(prisma, {
    organizationId: context.organizationId,
    requestId: input.requestId,
    requestUntil: input.requestUntil,
    userId: "__organization__",
    projects: context.projects,
    skipUserAcknowledgements: true,
  });
}
