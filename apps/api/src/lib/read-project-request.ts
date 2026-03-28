import type { FastifyRequest } from "fastify";
import { prisma } from "./db.js";
import { readProjectIdFromEnv } from "./project-scope.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function headerFirst(
  request: FastifyRequest,
  name: string
): string | undefined {
  const v = request.headers[name];
  if (v === undefined) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  const t = typeof s === "string" ? s.trim() : "";
  return t || undefined;
}

/**
 * Dashboard sends `X-Project-Id` to scope reads. Validates UUID and that the project exists
 * and is not soft-deleted; otherwise falls back to `TELEMETRY_PROJECT_ID`.
 */
export async function resolveReadProjectId(
  request: FastifyRequest
): Promise<string> {
  const fallback = readProjectIdFromEnv();
  const raw = headerFirst(request, "x-project-id");
  if (!raw || !UUID_RE.test(raw)) return fallback;
  const row = await prisma.project.findFirst({
    where: { id: raw, deleted_at: null },
    select: { id: true },
  });
  return row?.id ?? fallback;
}
