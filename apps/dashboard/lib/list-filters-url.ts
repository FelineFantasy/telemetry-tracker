import {
  DEFAULT_DASHBOARD_TIME_RANGE,
  hasExplicitTimeRangeQuery,
} from "./time-range";

/** API-only query keys never written to the dashboard URL. */
const API_ONLY_URL_KEYS = new Set(["metricsUntil", "view"]);

/** Merge URL-backed params for history updates and shareable links. */
export function mergeDashboardUrlParams(
  urlParams: Record<string, string>,
  listParams: Record<string, string>
): Record<string, string> {
  const merged = { ...urlParams, ...listParams };
  for (const key of API_ONLY_URL_KEYS) {
    delete merged[key];
  }
  return merged;
}

/**
 * Merge updates into current query params for dashboard list pages.
 * Clears `page` so filter changes return to page 1.
 */
export function mergeListQuery(
  path: string,
  current: Record<string, string>,
  updates: Record<string, string | null | undefined>
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v !== "") p.set(k, v);
  }
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || v === undefined || v === "") p.delete(k);
    else p.set(k, v);
  }
  if (!Object.prototype.hasOwnProperty.call(updates, "page")) {
    p.delete("page");
  }
  const q = p.toString();
  return q ? `${path}?${q}` : path;
}

/** Redirect target when the URL has no explicit time filter (first visit). */
export function redirectHrefIfMissingTimeRange(
  path: string,
  current: Record<string, string>,
  defaultKey: string = DEFAULT_DASHBOARD_TIME_RANGE
): string | null {
  if (
    hasExplicitTimeRangeQuery({
      range: current.range,
      from: current.from,
      to: current.to,
    })
  ) {
    return null;
  }
  return mergeListQuery(path, current, {
    range: defaultKey,
    from: null,
    to: null,
  });
}

/** @deprecated Use parseListTimeRangeOrDefault from @/lib/time-range */
export function effectiveListRange(
  params: { range?: string; from?: string; to?: string },
  defaultRange: string
): { activePreset: string; customRange: boolean } {
  if (params.from?.trim() || params.to?.trim()) {
    return { activePreset: "custom", customRange: true };
  }
  const r = params.range?.trim();
  if (r) return { activePreset: r, customRange: false };
  return { activePreset: defaultRange, customRange: false };
}
