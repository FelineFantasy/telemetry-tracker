/**
 * Global Search (#494) dashboard helpers: fetch + deep-link builders.
 */

import {
  buildDashboardScopedListHref,
  buildErrorGroupDetailHref,
  buildEventListHref,
  type DashboardListScope,
  UNKNOWN_RELEASE_KEY,
} from "@/lib/overview-scope-url";

export const GLOBAL_SEARCH_LIMIT_PER_GROUP = 8;

export type GlobalSearchErrorHit = {
  id: string;
  title: string;
  subtitle: string | null;
  app: string;
  environment: string | null;
  release: string | null;
  platform: string | null;
  lastSeenAt: string;
};

export type GlobalSearchEventHit = {
  name: string;
  title: string;
  eventCount: number;
  lastSeenAt: string;
};

export type GlobalSearchSessionHit = {
  id: string;
  sessionId: string;
  title: string;
  subtitle: string | null;
  userId: string | null;
  anonymousId: string | null;
  country: string | null;
  browser: string | null;
  platform: string | null;
  release: string | null;
  startedAt: string;
};

export type GlobalSearchReleaseHit = {
  releaseKey: string;
  title: string;
};

export type GlobalSearchUserHit = {
  identity: string;
  identityKind: "user" | "anonymous";
  title: string;
  subtitle: string | null;
};

export type GlobalSearchGroup<T> = {
  items: T[];
  truncated: boolean;
};

export type GlobalSearchResult = {
  q: string;
  parsed: {
    freeText: string;
    freeTextTerms: string[];
    filters: Record<string, string>;
    ignoredKeys: string[];
  };
  limitPerGroup: number;
  emptyQuery: boolean;
  groups: {
    errors: GlobalSearchGroup<GlobalSearchErrorHit>;
    events: GlobalSearchGroup<GlobalSearchEventHit>;
    sessions: GlobalSearchGroup<GlobalSearchSessionHit>;
    releases: GlobalSearchGroup<GlobalSearchReleaseHit>;
    users: GlobalSearchGroup<GlobalSearchUserHit>;
  };
};

export type GlobalSearchResultItem =
  | { kind: "error"; hit: GlobalSearchErrorHit; href: string }
  | { kind: "event"; hit: GlobalSearchEventHit; href: string }
  | { kind: "session"; hit: GlobalSearchSessionHit; href: string }
  | { kind: "release"; hit: GlobalSearchReleaseHit; href: string }
  | { kind: "user"; hit: GlobalSearchUserHit; href: string };

/** Build list URL params from search result filters + dashboard scope. */
export function buildSearchViewAllScope(
  scope: DashboardListScope,
  parsedFilters: Record<string, string>
): DashboardListScope {
  return {
    ...scope,
    environment: parsedFilters.environment ?? scope.environment,
    platform: parsedFilters.platform ?? scope.platform,
    release: parsedFilters.release ?? scope.release,
    range: parsedFilters.range ?? scope.range,
    from: parsedFilters.from ?? scope.from,
    to: parsedFilters.to ?? scope.to,
  };
}

export function buildErrorHitHref(
  hit: GlobalSearchErrorHit,
  scope: DashboardListScope
): string {
  return buildErrorGroupDetailHref(hit.id, scope);
}

export function buildEventHitHref(
  hit: GlobalSearchEventHit,
  scope: DashboardListScope
): string {
  return buildEventListHref(hit.name, scope);
}

export function buildSessionHitHref(
  hit: GlobalSearchSessionHit,
  scope: DashboardListScope
): string {
  const base = buildDashboardScopedListHref(`/dashboard/sessions/${hit.id}`, scope);
  return base;
}

export function buildReleaseHitHref(
  hit: GlobalSearchReleaseHit,
  scope: DashboardListScope
): string {
  return buildDashboardScopedListHref("/dashboard/releases", {
    ...scope,
    release: hit.releaseKey || UNKNOWN_RELEASE_KEY,
  });
}

export function buildUserHitHref(
  hit: GlobalSearchUserHit,
  scope: DashboardListScope,
  parsedFilters: Record<string, string> = {}
): string {
  const params = new URLSearchParams();
  if (scope.app) params.set("app", scope.app);
  if (scope.environment) params.set("environment", scope.environment);
  if (scope.platform) params.set("platform", scope.platform);
  if (scope.release) params.set("release", scope.release);
  if (scope.range) params.set("range", scope.range);
  if (scope.from) params.set("from", scope.from);
  if (scope.to) params.set("to", scope.to);
  if (scope.metricsUntil) params.set("metricsUntil", scope.metricsUntil);
  if (parsedFilters.country) params.set("country", parsedFilters.country);
  // Sessions list has no browser=/device= params; fold into `q` like View all.
  const sessionQ = [hit.identity, parsedFilters.browser, parsedFilters.device]
    .filter(Boolean)
    .join(" ")
    .trim();
  params.set("q", sessionQ || hit.identity);
  return `/dashboard/sessions?${params.toString()}`;
}

/** View-all list hrefs take API `parsed.freeText` (not raw `q`) so colon-bearing free-text terms are kept. */
export function buildViewAllErrorsHref(
  freeText: string,
  scope: DashboardListScope,
  parsedFilters: Record<string, string>
): string {
  const listScope = buildSearchViewAllScope(scope, parsedFilters);
  const params = new URLSearchParams();
  if (listScope.app) params.set("app", listScope.app);
  if (listScope.environment) params.set("environment", listScope.environment);
  if (listScope.platform) params.set("platform", listScope.platform);
  if (listScope.release) params.set("release", listScope.release);
  if (listScope.range) params.set("range", listScope.range);
  if (listScope.from) params.set("from", listScope.from);
  if (listScope.to) params.set("to", listScope.to);
  if (listScope.metricsUntil) params.set("metricsUntil", listScope.metricsUntil);
  const errorFilter = parsedFilters.error;
  const messageQ = [freeText.trim(), errorFilter].filter(Boolean).join(" ").trim();
  if (messageQ) params.set("q", messageQ);
  const qs = params.toString();
  return qs ? `/dashboard/errors?${qs}` : "/dashboard/errors";
}

export function buildViewAllEventsHref(
  freeText: string,
  scope: DashboardListScope,
  parsedFilters: Record<string, string>
): string {
  const listScope = buildSearchViewAllScope(scope, parsedFilters);
  const params = new URLSearchParams();
  if (listScope.app) params.set("app", listScope.app);
  if (listScope.environment) params.set("environment", listScope.environment);
  if (listScope.platform) params.set("platform", listScope.platform);
  if (listScope.release) params.set("release", listScope.release);
  if (listScope.range) params.set("range", listScope.range);
  if (listScope.from) params.set("from", listScope.from);
  if (listScope.to) params.set("to", listScope.to);
  if (listScope.metricsUntil) params.set("metricsUntil", listScope.metricsUntil);
  // Events list `q` matches Global Search: each term ILIKE on name OR properties (AND).
  const free = freeText.trim();
  if (free) params.set("q", free);
  const qs = params.toString();
  return qs ? `/dashboard/events?${qs}` : "/dashboard/events";
}

export function buildViewAllSessionsHref(
  freeText: string,
  scope: DashboardListScope,
  parsedFilters: Record<string, string>
): string {
  const listScope = buildSearchViewAllScope(scope, parsedFilters);
  const params = new URLSearchParams();
  if (listScope.app) params.set("app", listScope.app);
  if (listScope.environment) params.set("environment", listScope.environment);
  if (listScope.platform) params.set("platform", listScope.platform);
  if (listScope.release) params.set("release", listScope.release);
  if (listScope.range) params.set("range", listScope.range);
  if (listScope.from) params.set("from", listScope.from);
  if (listScope.to) params.set("to", listScope.to);
  if (listScope.metricsUntil) params.set("metricsUntil", listScope.metricsUntil);
  if (parsedFilters.country) params.set("country", parsedFilters.country);
  // Sessions list has no dedicated device= param; fold device into `q` (ILIKE device fields).
  const sessionQ = [
    freeText.trim(),
    parsedFilters.user,
    parsedFilters.browser,
    parsedFilters.device,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (sessionQ) params.set("q", sessionQ);
  const qs = params.toString();
  return qs ? `/dashboard/sessions?${qs}` : "/dashboard/sessions";
}

export function buildViewAllReleasesHref(
  scope: DashboardListScope,
  parsedFilters: Record<string, string>
): string {
  return buildDashboardScopedListHref(
    "/dashboard/releases",
    buildSearchViewAllScope(scope, parsedFilters)
  );
}

export function flattenSearchResults(
  result: GlobalSearchResult,
  scope: DashboardListScope
): GlobalSearchResultItem[] {
  // Merge structured filters from `q` into deep-link scope (query filters win).
  const linkScope = buildSearchViewAllScope(scope, result.parsed.filters);
  const items: GlobalSearchResultItem[] = [];
  for (const hit of result.groups.errors.items) {
    items.push({ kind: "error", hit, href: buildErrorHitHref(hit, linkScope) });
  }
  for (const hit of result.groups.events.items) {
    items.push({ kind: "event", hit, href: buildEventHitHref(hit, linkScope) });
  }
  for (const hit of result.groups.sessions.items) {
    items.push({ kind: "session", hit, href: buildSessionHitHref(hit, linkScope) });
  }
  for (const hit of result.groups.releases.items) {
    items.push({ kind: "release", hit, href: buildReleaseHitHref(hit, linkScope) });
  }
  for (const hit of result.groups.users.items) {
    items.push({
      kind: "user",
      hit,
      href: buildUserHitHref(hit, linkScope, result.parsed.filters),
    });
  }
  return items;
}

export function totalSearchHitCount(result: GlobalSearchResult): number {
  return (
    result.groups.errors.items.length +
    result.groups.events.items.length +
    result.groups.sessions.items.length +
    result.groups.releases.items.length +
    result.groups.users.items.length
  );
}
