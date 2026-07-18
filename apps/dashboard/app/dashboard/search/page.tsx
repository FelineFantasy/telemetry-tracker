import { PageTitle } from "@/app/components/PageTitle";
import { GlobalSearchClient } from "@/app/components/dashboard/GlobalSearchClient";
import { ErrorState } from "@/app/components/ErrorState";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { firstQueryValue } from "@/lib/search-params";
import type { DashboardListScope } from "@/lib/overview-scope-url";
import type { GlobalSearchResult } from "@/lib/global-search";

async function fetchGlobalSearch(
  search: URLSearchParams
): Promise<GlobalSearchResult | null> {
  const res = await dashboardApiFetch(`/api/search?${search.toString()}`);
  if (!res.ok) return null;
  return (await res.json()) as GlobalSearchResult;
}

export default async function GlobalSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = firstQueryValue(sp.q) ?? "";
  const appFilter = firstQueryValue(sp.app) ?? "";
  const platform = firstQueryValue(sp.platform);
  const environment = firstQueryValue(sp.environment);
  const release = firstQueryValue(sp.release);
  const range = firstQueryValue(sp.range);
  const from = firstQueryValue(sp.from);
  const to = firstQueryValue(sp.to);
  const metricsUntil = firstQueryValue(sp.metricsUntil);

  const listScope: DashboardListScope = {
    app: appFilter || null,
    environment: environment || null,
    platform: platform || null,
    release: release || null,
    range: range || null,
    from: from || null,
    to: to || null,
    metricsUntil: metricsUntil || null,
  };

  const hiddenScope: Record<string, string> = {};
  if (appFilter) hiddenScope.app = appFilter;
  if (environment) hiddenScope.environment = environment;
  if (platform) hiddenScope.platform = platform;
  if (release) hiddenScope.release = release;
  if (range) hiddenScope.range = range;
  if (from) hiddenScope.from = from;
  if (to) hiddenScope.to = to;
  if (metricsUntil) hiddenScope.metricsUntil = metricsUntil;

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
