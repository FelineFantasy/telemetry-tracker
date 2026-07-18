import { API_BASE_URL } from "@/lib/api-url";

/**
 * Resolve a dashboard API path against the fixed `API_BASE_URL` origin.
 *
 * Only relative `/api/...` paths are accepted. Absolute URLs, scheme-relative
 * URLs, and path traversal that would leave `/api/` are rejected so
 * `dashboardApiFetch` cannot be pointed at an arbitrary host or route.
 */
export function resolveDashboardApiUrl(pathAndQuery: string): string {
  const trimmed = pathAndQuery.trim();
  if (!trimmed.startsWith("/api/")) {
    throw new Error("Dashboard API path must be a relative /api/... URL");
  }
  if (
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    trimmed.includes("\0") ||
    /^\/api\/[^?#]*:/.test(trimmed)
  ) {
    throw new Error("Dashboard API path must not contain a scheme or authority");
  }

  const base = new URL(API_BASE_URL);
  const resolved = new URL(trimmed, base);

  if (resolved.origin !== base.origin) {
    throw new Error("Dashboard API URL must stay on the configured API origin");
  }
  if (!resolved.pathname.startsWith("/api/")) {
    throw new Error("Dashboard API URL pathname must remain under /api/");
  }

  return resolved.toString();
}

/** UUID path segment for resource ids interpolated into `/api/...` paths. */
const API_RESOURCE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalize a resource id for path interpolation. Rejects traversal, query,
 * fragment, and non-UUID values (`foo/bar`, `?q`, `#f`, `../`, etc.).
 */
export function parseDashboardApiResourceId(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!API_RESOURCE_UUID_RE.test(trimmed)) return null;
  return trimmed;
}
