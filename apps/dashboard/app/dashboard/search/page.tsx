import { PageTitle } from "@/app/components/PageTitle";
import { GlobalSearchClient } from "@/app/components/dashboard/GlobalSearchClient";
import { ErrorState } from "@/app/components/ErrorState";
import { redirect } from "next/navigation";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import {
  redirectHrefForMetricsUntil,
  redirectHrefIfMissingTimeRange,
} from "@/lib/list-filters-url";
import { firstQueryValue } from "@/lib/search-params";
import type { DashboardListScope } from "@/lib/overview-scope-url";
import type { GlobalSearchResult } from "@/lib/global-search";
import {
  isUnselectedTimeRange,
  parseListTimeRangeOrDefault,
  resolveMetricsUntilIso,
} from "@/lib/time-range";

const SEARCH_PATH = "/dashboard/search";

async function fetchGlobalSearch(
  search: URLSearchParams
): Promise<GlobalSearchResult | null> {
  const res = await dashboardApiFetch(`/api/search?${search.toString()}`);
  if (!res.ok) return null;
  return (await res.json()) as GlobalSearchResult;
}

function buildSearchParamsRecord(sp: Record<string, string | string[] | undefined>) {
  const keys = [
    "q",
    "app",
    "environment",
    "platform",
    "release",
    "range",
    "from",
    "to",
    "metricsUntil",
  ] as const;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = firstQueryValue(sp[k]);
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

export default async function GlobalSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const currentParams = buildSearchParamsRecord(sp);
  const defaultTimeHref = redirectHrefIfMissingTimeRange(SEARCH_PATH, currentParams);
  if (defaultTimeHref) redirect(defaultTimeHref);

  const q = firstQueryValue(sp.q) ?? "";
  const appFilter = firstQueryValue(sp.app) ?? "";
  const platform = firstQueryValue(sp.platform);
  const environment = firstQueryValue(sp.environment);
  const release = firstQueryValue(sp.release);
  const range = firstQueryValue(sp.range);
  const from = firstQueryValue(sp.from);
  const to = firstQueryValue(sp.to);

  const timeRange = parseListTimeRangeOrDefault(
    {
      range,
      from: from || undefined,
      to: to || undefined,
    },
    "all"
  );
  const pageAnchorIso = isUnselectedTimeRange(timeRange.key)
    ? resolveMetricsUntilIso(firstQueryValue(sp.metricsUntil))
    : null;
  const metricsUntilHref = redirectHrefForMetricsUntil(
    SEARCH_PATH,
    currentParams,
    timeRange.key,
    pageAnchorIso
  );
  if (metricsUntilHref) redirect(metricsUntilHref);

  const listScope: DashboardListScope = {
    app: appFilter || null,
    environment: environment || null,
    platform: platform || null,
    release: release || null,
    range: range || null,
    from: from || null,
    to: to || null,
    metricsUntil: pageAnchorIso,
  };

  const hiddenScope: Record<string, string> = {};
  if (appFilter) hiddenScope.app = appFilter;
  if (environment) hiddenScope.environment = environment;
  if (platform) hiddenScope.platform = platform;
  if (release) hiddenScope.release = release;
  if (range) hiddenScope.range = range;
  if (from) hiddenScope.from = from;
  if (to) hiddenScope.to = to;
  if (pageAnchorIso) hiddenScope.metricsUntil = pageAnchorIso;

  let result: GlobalSearchResult | null = null;
  let loadError: string | null = null;

  if (q.trim()) {
    const apiQuery = new URLSearchParams();
    apiQuery.set("q", q);
    for (const [k, v] of Object.entries(hiddenScope)) {
      apiQuery.set(k, v);
    }
    try {
      result = await fetchGlobalSearch(apiQuery);
      if (!result) {
        loadError = "Could not load search results.";
      }
    } catch (e) {
      return (
        <>
          <PageTitle title="Search" />
          <ErrorState message={String(e instanceof Error ? e.message : e)} />
        </>
      );
    }
  } else {
    result = {
      q: "",
      parsed: { freeText: "", freeTextTerms: [], filters: {}, ignoredKeys: [] },
      limitPerGroup: 8,
      emptyQuery: true,
      groups: {
        errors: { items: [], truncated: false },
        events: { items: [], truncated: false },
        sessions: { items: [], truncated: false },
        releases: { items: [], truncated: false },
        users: { items: [], truncated: false },
      },
    };
  }

  return (
    <>
      <PageTitle title="Search" />
      <GlobalSearchClient
        initialQuery={q}
        result={result}
        scope={listScope}
        hiddenScope={hiddenScope}
        loadError={loadError}
      />
    </>
  );
}
