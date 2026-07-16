/** URL helpers for overview scope (app, environment, platform, release, compare). */

export type OverviewCompareParam = "previous" | "week-ago";

export function parseOverviewCompare(raw: string | undefined): OverviewCompareParam {
  return raw === "week-ago" ? "week-ago" : "previous";
}

export function compareLabelFor(
  param: OverviewCompareParam,
  rangeLabel: string
): string {
  if (param === "week-ago") return "vs same window last week";
  if (rangeLabel === "Recent data") return "vs earlier data";
  const normalized = rangeLabel.replace(/^Last /i, "");
  return `vs prior ${normalized.toLowerCase()}`;
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

/** Preserve dashboard scope when switching top-level dashboard tabs. */
export function buildDashboardNavTabHref(
  path: string,
  searchParams: URLSearchParams
): string {
  const params = new URLSearchParams();
  const app = searchParams.get("app");
  const environment = searchParams.get("environment");
  const platform = searchParams.get("platform");
  const release = searchParams.get("release");
  if (app) params.set("app", app);
  if (environment) params.set("environment", environment);
  if (platform) params.set("platform", platform);
  if (release) params.set("release", release);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

export type DashboardListScope = {
  app?: string | null;
  environment?: string | null;
  platform?: string | null;
  release?: string | null;
  range?: string | null;
  from?: string | null;
  to?: string | null;
  /** When set, error detail applies the Issues ~7d metrics window for unbounded ranges. */
  metricsUntil?: string | null;
};

function appendDashboardListScope(params: URLSearchParams, scope: DashboardListScope): void {
  if (scope.app) params.set("app", scope.app);
  if (scope.environment) params.set("environment", scope.environment);
  if (scope.platform) params.set("platform", scope.platform);
  if (scope.release) params.set("release", scope.release);
  if (scope.range) params.set("range", scope.range);
  if (scope.from) params.set("from", scope.from);
  if (scope.to) params.set("to", scope.to);
  if (scope.metricsUntil) params.set("metricsUntil", scope.metricsUntil);
}

/** Preserve list filters when linking between dashboard pages. */
export function buildDashboardScopedListHref(
  path: string,
  scope: DashboardListScope
): string {
  const params = new URLSearchParams();
  appendDashboardListScope(params, scope);
  const q = params.toString();
  return q ? `${path}?${q}` : path;
}

/** Preserve event-name drill-down scope from overview. */
export function buildEventListHref(
  eventName: string,
  scope: DashboardListScope
): string {
  const params = new URLSearchParams();
  params.set("name", eventName);
  appendDashboardListScope(params, scope);
  return `/dashboard/events?${params.toString()}`;
}

export function mergeOverviewScopeQuery(
  path: string,
  current: Record<string, string>,
  updates: {
    app?: string | null;
    environment?: string | null;
    platform?: string | null;
    release?: string | null;
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

export function buildErrorGroupDetailHref(
  id: string,
  scope: DashboardListScope
): string {
  const params = new URLSearchParams();
  appendDashboardListScope(params, scope);
  const q = params.toString();
  return q ? `/dashboard/errors/${id}?${q}` : `/dashboard/errors/${id}`;
}

export function formatOverviewDeltaLine(
  delta: number,
  kind: "errors" | "events",
  compareLabel: string
): { className: string; text: string } {
  const baseline = compareLabel.replace(/^vs /, "");
  if (delta === 0) {
    return { className: "vs-previous", text: `Same as ${baseline}` };
  }
  const sign = delta > 0 ? "+" : "";
  const text = `${sign}${delta} ${compareLabel}`;
  if (kind === "errors") {
    return {
      className:
        delta > 0 ? "vs-previous positive" : delta < 0 ? "vs-previous negative" : "vs-previous",
      text,
    };
  }
  return {
    className:
      delta > 0 ? "vs-previous negative" : delta < 0 ? "vs-previous positive" : "vs-previous",
    text,
  };
}
