import { API_BASE_URL } from "@/lib/api-url";

/**
 * Resolve a dashboard API path against the fixed `API_BASE_URL` origin
 * (and any path prefix on that base).
 *
 * Only relative `/api/...` paths are accepted. Absolute URLs, scheme-relative
 * URLs, and path traversal that would leave the base `/api/` root are rejected
 * so `dashboardApiFetch` cannot be pointed at an arbitrary host or route.
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

  // Join as a relative path so an `API_URL` path prefix is preserved.
  // `new URL("/api/...", base)` would replace the base pathname entirely.
  const baseHref = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const base = new URL(baseHref);
  const resolved = new URL(trimmed.slice(1), base);

  if (resolved.origin !== base.origin) {
    throw new Error("Dashboard API URL must stay on the configured API origin");
  }

  const basePath = base.pathname.replace(/\/$/, "") || "";
  const apiPrefix = `${basePath}/api/`;
  if (!resolved.pathname.startsWith(apiPrefix)) {
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
