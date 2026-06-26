const LOCAL_DEV_ORIGIN = "http://localhost:3000";

/** Configured dashboard base URL without trailing slash, or null when unset. */
export function resolveDashboardOrigin(): string | null {
  const raw = process.env.TELEMETRY_DASHBOARD_ORIGIN?.trim();
  return raw ? raw.replace(/\/$/, "") : null;
}

/**
 * Dashboard base URL for absolute links (Stripe redirects, password reset emails).
 * Uses `TELEMETRY_DASHBOARD_ORIGIN` when set; otherwise localhost in non-production only.
 */
export function dashboardOriginOrNull(): string | null {
  const configured = resolveDashboardOrigin();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;
  return LOCAL_DEV_ORIGIN;
}
