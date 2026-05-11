import type { FastifyRequest } from "fastify";

/** First header value, trimmed; Node may represent headers as `string | string[]`. */
export function headerFirst(
  request: FastifyRequest,
  name: string
): string | undefined {
  const v = request.headers[name];
  if (v === undefined) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  const t = typeof s === "string" ? s.trim() : "";
  return t || undefined;
}

const ORGANIZATION_ID_HEADER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validated `X-Organization-Id` from dashboard requests (UUID, lowercased). */
export function readOrganizationIdHeader(request: FastifyRequest): string | undefined {
  const raw = headerFirst(request, "x-organization-id");
  if (!raw || !ORGANIZATION_ID_HEADER_UUID_RE.test(raw)) return undefined;
  return raw.toLowerCase();
}
