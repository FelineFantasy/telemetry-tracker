/** URL helpers for overview scope (app, environment, platform, release, compare). */

/** Explicit sentinel for null/blank release values (Release Health #453). */
export const UNKNOWN_RELEASE_KEY = "__unknown__";

/**
 * Period compare modes (#495). Calendar presets use UTC boundaries.
 * Query params: `compare`, optional `compareFrom` / `compareTo` for `custom`.
 */
export const COMPARE_PARAMS = [
  "previous",
  "week-ago",
  "today-yesterday",
  "week",
  "month",
  "custom",
] as const;

export type OverviewCompareParam = (typeof COMPARE_PARAMS)[number];

export function parseOverviewCompare(
  raw: string | undefined | null
): OverviewCompareParam {
  const value = raw?.trim().toLowerCase() ?? "";
  if ((COMPARE_PARAMS as readonly string[]).includes(value)) {
    return value as OverviewCompareParam;
  }
  return "previous";
}

/** Rolling modes keep the page range; calendar/custom replace the KPI window. */
export function isRollingCompareParam(param: OverviewCompareParam): boolean {
  return param === "previous" || param === "week-ago";
}

export function compareLabelFor(
  param: OverviewCompareParam,
  rangeLabel: string
): string {
  switch (param) {
    case "week-ago":
      return "vs same window last week";
    case "today-yesterday":
      return "vs yesterday";
    case "week":
      return "vs last week";
    case "month":
      return "vs last month";
    case "custom":
      return "vs custom period";
    default: {
      if (rangeLabel === "Recent data") return "vs earlier data";
      const normalized = rangeLabel.replace(/^Last /i, "");
      return `vs prior ${normalized.toLowerCase()}`;
    }
  }
}

/** Keep only query values present in the scoped allow-list (app/env pickers). */
export function resolveScopedQueryValue(
  raw: string | null | undefined,
  allowed: readonly string[]
): string | null {
  const value = raw?.trim() ?? "";
  if (value === "") return null;
  // Always allow the Unknown release sentinel so Issues deep links are not stripped.
  if (value === UNKNOWN_RELEASE_KEY) return UNKNOWN_RELEASE_KEY;
  if (!allowed.includes(value)) return null;
  return value;
}

/** Release filter options including the explicit Unknown bucket (#453). */
export function releaseFilterSelectOptions(
  releases: readonly string[]
): Array<{ value: string; label: string }> {
  const known = releases.filter((r) => r !== UNKNOWN_RELEASE_KEY);
  return [
    { value: "", label: "Any" },
    { value: UNKNOWN_RELEASE_KEY, label: "Unknown" },
    ...known.map((e) => ({ value: e, label: e })),
  ];
}

export type DashboardListScope = {
  app?: string | null;
  environment?: string | null;
  platform?: string | null;
  release?: string | null;
  range?: string | null;
  from?: string | null;
  to?: string | null;
  /** When set, list/KPI pages apply the Issues ~7d metrics window for unbounded ranges. */
  metricsUntil?: string | null;
  /**
   * With metricsUntil, issue detail uses this exact Overview metrics window
   * instead of the Issues-list ~7d path. Not forwarded on list deep links.
   */
  metricsSince?: string | null;
  /** Period compare mode (#495). */
  compare?: string | null;
  compareFrom?: string | null;
  compareTo?: string | null;
};

function appendDashboardListScope(params: URLSearchParams, scope: DashboardListScope): void {
  if (scope.app) params.set("app", scope.app);
  if (scope.environment) params.set("environment", scope.environment);
  if (scope.platform) params.set("platform", scope.platform);
  if (scope.release) params.set("release", scope.release);
  if (scope.range) params.set("range", scope.range);
  if (scope.from) params.set("from", scope.from);
  if (scope.to) params.set("to", scope.to);
  if (scope.metricsSince) params.set("metricsSince", scope.metricsSince);
  if (scope.metricsUntil) params.set("metricsUntil", scope.metricsUntil);
  if (scope.compare && scope.compare !== "previous") params.set("compare", scope.compare);
  if (scope.compareFrom) params.set("compareFrom", scope.compareFrom);
  if (scope.compareTo) params.set("compareTo", scope.compareTo);
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

/**
 * Preserve dashboard scope when switching top-level dashboard tabs.
 * Forwards the same allow-list as scoped list deep links (including the KPI window).
 */
export function buildDashboardNavTabHref(
  path: string,
  searchParams: URLSearchParams
): string {
  return buildDashboardScopedListHref(path, {
    app: searchParams.get("app"),
    environment: searchParams.get("environment"),
    platform: searchParams.get("platform"),
    release: searchParams.get("release"),
    range: searchParams.get("range"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    metricsUntil: searchParams.get("metricsUntil"),
    compare: searchParams.get("compare"),
    compareFrom: searchParams.get("compareFrom"),
    compareTo: searchParams.get("compareTo"),
  });
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

/**
 * Deep-link to Events filtered to `$request` rows for a slow route (#196).
 * Free-text `q` includes method + path so property JSON matches both fields.
 * Pass a scope already aligned to the table's resolved metrics window
 * (see {@link scopeForPerformanceEventsDrillDown}).
 */
export function buildSlowRouteEventsHref(
  method: string,
  url: string,
  scope: DashboardListScope
): string {
  const params = new URLSearchParams();
  params.set("name", "$request");
  const terms = [method.trim(), url.trim()].filter(Boolean);
  if (terms.length > 0) params.set("q", terms.join(" "));
  appendDashboardListScope(params, scope);
  return `/dashboard/events?${params.toString()}`;
}

/**
 * Deep-link to `$web_vital` Events for a slow page path (#196).
 * Pass a scope already aligned to the table's resolved metrics window
 * (see {@link scopeForPerformanceEventsDrillDown}).
 */
export function buildSlowPageWebVitalEventsHref(
  path: string,
  scope: DashboardListScope
): string {
  const params = new URLSearchParams();
  params.set("name", "$web_vital");
  const pagePath = path.trim();
  if (pagePath) params.set("q", pagePath);
  appendDashboardListScope(params, scope);
  return `/dashboard/events?${params.toString()}`;
}

/**
 * Map Performance table scope to an Events list window that matches the
 * aggregated rows. Events list filtering ignores `compare*`, so calendar
 * compare modes must be expressed as an explicit custom `from`/`to` range.
 */
export function scopeForPerformanceEventsDrillDown(
  scope: DashboardListScope,
  window: { since: string; until: string }
): DashboardListScope {
  return {
    app: scope.app,
    environment: scope.environment,
    platform: scope.platform,
    release: scope.release,
    range: "custom",
    from: window.since,
    to: window.until,
  };
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
    compareFrom?: string | null;
    compareTo?: string | null;
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
  current: number,
  previous: number,
  kind: "errors" | "events",
  compareLabel: string
): { className: string; text: string } {
  if (previous <= 0) {
    if (current > 0) {
      return { className: "vs-previous", text: "New" };
    }
    return { className: "vs-previous", text: "—" };
  }
  const delta = current - previous;
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
