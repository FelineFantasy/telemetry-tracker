/** URL helpers for overview scope (app, environment, compare). */

export type OverviewCompareParam = "previous" | "week-ago";

export function parseOverviewCompare(raw: string | undefined): OverviewCompareParam {
  return raw === "week-ago" ? "week-ago" : "previous";
}

export function compareLabelFor(param: OverviewCompareParam, range: "24h" | "7d"): string {
  if (param === "week-ago") return "vs same window last week";
  return range === "7d" ? "vs previous 7 days" : "vs previous 24 hours";
}

/** Keep only query values present in the scoped allow-list (app/env pickers). */
export function resolveScopedQueryValue(
  raw: string | null | undefined,
  allowed: readonly string[]
): string | null {
  const value = raw?.trim() ?? "";
  if (value === "" || !allowed.includes(value)) return null;
  return value;
}

/** Preserve app/environment scope when switching top-level dashboard tabs. */
export function buildDashboardNavTabHref(
  path: string,
  searchParams: URLSearchParams
): string {
  const params = new URLSearchParams();
  const app = searchParams.get("app");
  const environment = searchParams.get("environment");
  if (app) params.set("app", app);
  if (environment) params.set("environment", environment);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

export function mergeOverviewScopeQuery(
  path: string,
  current: Record<string, string>,
  updates: {
    app?: string | null;
    environment?: string | null;
    compare?: OverviewCompareParam | null;
    range?: string | null;
    errorsPage?: string | null;
    eventsPage?: string | null;
  }
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v) params.set(k, v);
  }
  for (const [k, v] of Object.entries(updates)) {
    if (v === null) params.delete(k);
    else if (v !== undefined) params.set(k, v);
  }
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

export function buildDashboardHrefWithEnvironment(
  path: string,
  environment: string | null,
  searchParams: URLSearchParams
): string {
  const params = new URLSearchParams(searchParams);
  if (environment) params.set("environment", environment);
  else params.delete("environment");
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}
