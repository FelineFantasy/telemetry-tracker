const DASHBOARD_BASE = "/dashboard";

/** Path used when applying the `app` filter (preserves detail URLs). */
export function dashboardPathForAppFilter(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return `${DASHBOARD_BASE}/overview`;
  }
  return pathname?.startsWith(DASHBOARD_BASE) ? pathname : `${DASHBOARD_BASE}/overview`;
}

/** Clone query string and set or clear `app`. */
export function buildDashboardHrefWithApp(
  path: string,
  app: string | null,
  searchParams: URLSearchParams
): string {
  const params = new URLSearchParams(searchParams);
  if (app) params.set("app", app);
  else params.delete("app");
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}
