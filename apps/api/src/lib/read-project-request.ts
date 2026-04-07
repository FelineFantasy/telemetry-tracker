import type { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "./db.js";
import { getSessionUser } from "./auth-session.js";
import { headerFirst } from "./http-headers.js";
import { readProjectIdFromEnv } from "./project-scope.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Dashboard sends `X-Project-Id` to scope reads. Validates UUID and that the project exists
 * and is not soft-deleted. If a session is present, the user must be a member of the project’s
 * organization. Without a session, legacy behavior: any existing project id (or env fallback).
 * Returns `null` after sending 403 when the session user may not access the project.
 */
export async function resolveReadProjectId(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<string | null> {
  const fallback = readProjectIdFromEnv();
  const raw = headerFirst(request, "x-project-id");
  if (!raw || !UUID_RE.test(raw)) {
    return fallback;
  }

  const project = await prisma.project.findFirst({
    where: { id: raw, deleted_at: null },
    select: { id: true, organization_id: true },
  });
  if (!project) {
    return fallback;
  }

  const session = await getSessionUser(request);
  if (session) {
    const m = await prisma.organizationMembership.findFirst({
      where: {
        user_id: session.userId,
        organization_id: project.organization_id,
      },
    });
    if (!m) {
      await reply.status(403).send({ error: "Not a member of this project" });
      return null;
    }
    return project.id;
  }

  return project.id;
}

/**
 * Like {@link resolveReadProjectId} but never sends a reply. When a session exists and the user is
 * not a member of the project’s organization, returns `null` instead of 403 (for aggregating
 * session context with org-scoped permissions).
 */
export async function tryResolveReadProjectId(
  request: FastifyRequest
): Promise<string | null> {
  const fallback = readProjectIdFromEnv();
  const raw = headerFirst(request, "x-project-id");
  if (!raw || !UUID_RE.test(raw)) {
    return fallback;
  }

  const project = await prisma.project.findFirst({
    where: { id: raw, deleted_at: null },
    select: { id: true, organization_id: true },
  });
  if (!project) {
    return fallback;
  }

  const session = await getSessionUser(request);
  if (session) {
    const m = await prisma.organizationMembership.findFirst({
      where: {
        user_id: session.userId,
        organization_id: project.organization_id,
      },
    });
    if (!m) {
      return null;
    }
    return project.id;
  }

  return project.id;
}
