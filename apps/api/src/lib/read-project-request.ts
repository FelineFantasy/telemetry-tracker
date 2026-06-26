import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./db.js";
import { getSessionUser, type SessionUser } from "./auth-session.js";
import { headerFirst } from "./http-headers.js";
import { readProjectIdFromEnv } from "./project-scope.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Legacy unauthenticated reads: allowed in non-production or when explicitly enabled. */
export function allowUnauthenticatedReads(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.TELEMETRY_ALLOW_UNAUTHENTICATED_READS === "true";
}

type ProjectScope = {
  id: string;
  organizationId: string;
  orgArchived: boolean;
};

async function loadProjectScope(projectId: string): Promise<ProjectScope | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deleted_at: null },
    select: {
      id: true,
      organization_id: true,
      organization: { select: { deleted_at: true } },
    },
  });
  if (!project) return null;
  return {
    id: project.id,
    organizationId: project.organization_id,
    orgArchived: project.organization.deleted_at != null,
  };
}

async function membershipForUser(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const m = await prisma.organizationMembership.findFirst({
    where: { user_id: userId, organization_id: organizationId },
    select: { id: true },
  });
  return m != null;
}

/**
 * Dashboard sends `X-Project-Id` to scope reads. Validates UUID and that the project exists
 * and is not soft-deleted, and that its organization is not archived. If a session is present,
 * the user must be a member of the project’s organization. Without a session, legacy behavior
 * (dev only): any existing project id (or env fallback).
 * In production, unauthenticated reads return 401 unless `TELEMETRY_ALLOW_UNAUTHENTICATED_READS=true`.
 * Returns `null` after sending 403/401 when access is denied.
 */
export async function resolveReadProjectId(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<string | null> {
  const session = await getSessionUser(request);
  if (!session && !allowUnauthenticatedReads()) {
    await reply.status(401).send({ error: "Unauthorized" });
    return null;
  }

  const fallback = readProjectIdFromEnv();
  const raw = headerFirst(request, "x-project-id");
  if (!raw || !UUID_RE.test(raw)) {
    return fallback;
  }

  const project = await loadProjectScope(raw);
  if (!project) {
    return fallback;
  }

  if (project.orgArchived) {
    await reply.status(403).send({ error: "Organization has been archived" });
    return null;
  }

  if (session) {
    if (!(await membershipForUser(session.userId, project.organizationId))) {
      await reply.status(403).send({ error: "Not a member of this project" });
      return null;
    }
    return project.id;
  }

  return project.id;
}

/**
 * Same as {@link resolveReadProjectId} for an authenticated caller, but uses a pre-loaded
 * {@link SessionUser} so handlers can require the session once and avoid a second session lookup.
 */
export async function resolveReadProjectIdWithSession(
  request: FastifyRequest,
  reply: FastifyReply,
  session: SessionUser
): Promise<string | null> {
  const fallback = readProjectIdFromEnv();
  const raw = headerFirst(request, "x-project-id");
  if (!raw || !UUID_RE.test(raw)) {
    return fallback;
  }

  const project = await loadProjectScope(raw);
  if (!project) {
    return fallback;
  }

  if (project.orgArchived) {
    await reply.status(403).send({ error: "Organization has been archived" });
    return null;
  }

  if (!(await membershipForUser(session.userId, project.organizationId))) {
    await reply.status(403).send({ error: "Not a member of this project" });
    return null;
  }
  return project.id;
}

/**
 * Like {@link resolveReadProjectId} but never sends a reply. When a session exists and the user is
 * not a member of the project’s organization, or the organization is archived, returns `null`
 * instead of 403 (for aggregating session context with org-scoped permissions).
 */
export async function tryResolveReadProjectId(
  request: FastifyRequest
): Promise<string | null> {
  const session = await getSessionUser(request);
  if (!session && !allowUnauthenticatedReads()) {
    return null;
  }

  const fallback = readProjectIdFromEnv();
  const raw = headerFirst(request, "x-project-id");
  if (!raw || !UUID_RE.test(raw)) {
    return fallback;
  }

  const project = await loadProjectScope(raw);
  if (!project) {
    return fallback;
  }

  if (project.orgArchived) {
    return null;
  }

  if (session) {
    if (!(await membershipForUser(session.userId, project.organizationId))) {
      return null;
    }
    return project.id;
  }

  return project.id;
}
