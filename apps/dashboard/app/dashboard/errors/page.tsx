import { PageTitle } from "@/app/components/PageTitle";
import { redirect } from "next/navigation";
import { ErrorsClientListSection } from "@/app/components/dashboard/ErrorsClientListSection";
import { ErrorsSummaryMetrics, type ErrorsPageSummary } from "@/app/components/dashboard/ErrorsSummaryMetrics";
import { DeferredErrorsAnalytics } from "@/app/components/dashboard/DeferredErrorsAnalytics";
import { mergeListQuery, redirectHrefIfMissingTimeRange, redirectHrefForMetricsUntil } from "@/lib/list-filters-url";
import { appendListTimeRangeToParams, appendTrendTimeRangeToParams, isUnselectedTimeRange, parseListTimeRangeOrDefault, parseTrendTimeRangeOrDefault, resolveMetricsUntilIso } from "@/lib/time-range";
import { AnalyticsListShell } from "@/app/components/dashboard/analytics-ui";
import { ErrorState } from "@/app/components/ErrorState";
import {
  DEFAULT_LIST_PAGE_SIZE,
  parsePageParam,
  parsePageSizeParam,
  resolveApiListTotal,
} from "@/lib/pagination";
import { firstQueryValue } from "@/lib/search-params";
import { resolveScopedQueryValue } from "@/lib/overview-scope-url";
import { dashboardApiFetch } from "@/lib/dashboard-api";

const ERRORS_PATH = "/dashboard/errors";

type ErrorGroupRow = {
  id: string;
  message: string;
  app: string;
  top_stack?: string;
  occurrences: number;
  occurrences_in_range?: number;
  first_seen: string;
  last_seen: string;
  resolved_at?: string | null;
  environment?: string | null;
  users_affected?: number;
  sessions_affected?: number;
  occurrences_recent?: number;
  occurrences_previous?: number;
  trend_ratio?: number;
  error_type?: string;
  sparkline?: { t: string; count: number }[];
};

async function getErrors(
  search: URLSearchParams
): Promise<{
  items: ErrorGroupRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const res = await dashboardApiFetch(`/api/errors?${search.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function getErrorsSummary(search: URLSearchParams): Promise<ErrorsPageSummary | null> {
  const res = await dashboardApiFetch(`/api/errors/summary?${search.toString()}`);
  if (!res.ok) return null;
  return res.json();
}

async function getFilterOptions(app?: string) {
  const p = new URLSearchParams();
  if (app) p.set("app", app);
  const res = await dashboardApiFetch(`/api/filter-options?${p.toString()}`);
  if (!res.ok) {
    return {
      environments: [] as string[],
      platforms: [] as string[],
      releases: [] as string[],
    };
  }
  const data = (await res.json()) as {
    environments?: string[];
    platforms?: string[];
    releases?: string[];
  };
  return {
    environments: data.environments ?? [],
    platforms: data.platforms ?? [],
    releases: data.releases ?? [],
  };
}

function buildErrorsParamsRecord(sp: {
  app?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
  limit?: string | string[];
  range?: string | string[];
  from?: string | string[];
  to?: string | string[];
  metricsUntil?: string | string[];
  environment?: string | string[];
  platform?: string | string[];
  release?: string | string[];
  q?: string | string[];
  status?: string | string[];
  sort?: string | string[];
  order?: string | string[];
  trendWindow?: string | string[];
  trendFrom?: string | string[];
  trendTo?: string | string[];
}): Record<string, string> {
  const keys = [
    "app",
    "page",
    "pageSize",
    "limit",
    "range",
    "from",
    "to",
    "metricsUntil",
    "environment",
    "platform",
    "release",
    "q",
    "status",
    "sort",
    "order",
    "trendWindow",
    "trendFrom",
    "trendTo",
  ] as const;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = firstQueryValue(sp[k]);
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

export default async function ErrorsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    app?: string | string[];
    page?: string | string[];
    pageSize?: string | string[];
    limit?: string | string[];
    range?: string | string[];
    from?: string | string[];
    to?: string | string[];
    environment?: string | string[];
    platform?: string | string[];
    release?: string | string[];
    q?: string | string[];
    status?: string | string[];
    sort?: string | string[];
    order?: string | string[];
    trendWindow?: string | string[];
    trendFrom?: string | string[];
    trendTo?: string | string[];
    metricsUntil?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  let currentParams = buildErrorsParamsRecord(sp);
  const defaultTimeHref = redirectHrefIfMissingTimeRange(ERRORS_PATH, currentParams);
  if (defaultTimeHref) redirect(defaultTimeHref);
  const appFilter = firstQueryValue(sp.app) ?? "";
  const rawEnv = firstQueryValue(sp.environment)?.trim() || null;
  const rawPlatform = firstQueryValue(sp.platform)?.trim() || null;
  const rawRelease = firstQueryValue(sp.release)?.trim() || null;

  const page = parsePageParam(firstQueryValue(sp.page));
  const pageSize = parsePageSizeParam(
    firstQueryValue(sp.pageSize),
    firstQueryValue(sp.limit)
  );
  const from = firstQueryValue(sp.from) ?? "";
  const to = firstQueryValue(sp.to) ?? "";
  const timeRange = parseListTimeRangeOrDefault(
    {
      range: firstQueryValue(sp.range),
      from: from || undefined,
      to: to || undefined,
    },
    "all"
  );

  const pageAnchorIso = isUnselectedTimeRange(timeRange.key)
    ? resolveMetricsUntilIso(firstQueryValue(sp.metricsUntil))
    : null;
  const metricsUntilHref = redirectHrefForMetricsUntil(
    ERRORS_PATH,
    currentParams,
    timeRange.key,
    pageAnchorIso
  );
  if (metricsUntilHref) redirect(metricsUntilHref);
  if (pageAnchorIso) {
    currentParams = { ...currentParams, metricsUntil: pageAnchorIso };
  } else if (currentParams.metricsUntil) {
    const { metricsUntil: _stale, ...withoutMetricsUntil } = currentParams;
    currentParams = withoutMetricsUntil;
  }

  const apiQuery = new URLSearchParams();
  if (appFilter) apiQuery.set("app", appFilter);
  apiQuery.set("page", String(page));
  apiQuery.set("pageSize", String(pageSize));
  appendListTimeRangeToParams(apiQuery, timeRange, from, to);
  const trendFrom = firstQueryValue(sp.trendFrom) ?? "";
  const trendTo = firstQueryValue(sp.trendTo) ?? "";
  const trendTimeRange = parseTrendTimeRangeOrDefault(
    {
      trendWindow: firstQueryValue(sp.trendWindow),
      trendFrom: trendFrom || undefined,
      trendTo: trendTo || undefined,
    },
    "24h"
  );
  appendTrendTimeRangeToParams(apiQuery, trendTimeRange, trendFrom, trendTo);
  const q = firstQueryValue(sp.q);
  const status = firstQueryValue(sp.status);
  const sort = firstQueryValue(sp.sort);
  const order = firstQueryValue(sp.order);
  if (rawEnv) apiQuery.set("environment", rawEnv);
  if (rawPlatform) apiQuery.set("platform", rawPlatform);
  if (rawRelease) apiQuery.set("release", rawRelease);
  if (q) apiQuery.set("q", q);
  if (status) apiQuery.set("status", status);
  if (sort) apiQuery.set("sort", sort);
  if (order) apiQuery.set("order", order);
  if (pageAnchorIso) {
    apiQuery.set("metricsUntil", pageAnchorIso);
  }

  const summaryQuery = new URLSearchParams(apiQuery);
  summaryQuery.delete("page");
  summaryQuery.delete("pageSize");
  summaryQuery.delete("sort");
  summaryQuery.delete("order");
  summaryQuery.delete("trendWindow");
  summaryQuery.delete("trendFrom");
  summaryQuery.delete("trendTo");

  let initialListData: {
    items: ErrorGroupRow[];
    total: number;
    page: number;
    pageSize: number;
  };
  let summary: ErrorsPageSummary | null = null;
  let filterOptions: {
    environments: string[];
    platforms: string[];
    releases: string[];
  } | null = null;

  try {
    const [opts, data, summaryData] = await Promise.all([
      getFilterOptions(appFilter || undefined),
      getErrors(apiQuery),
      getErrorsSummary(summaryQuery),
    ]);
    filterOptions = opts;
    initialListData = {
      items: data.items ?? [],
      total: resolveApiListTotal(data.total, data.items?.length ?? 0),
      page: data.page ?? page,
      pageSize: data.pageSize ?? pageSize,
    };
    summary = summaryData;
  } catch (e) {
    return (
      <>
        <PageTitle title="Issues" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const options = filterOptions ?? {
    environments: [] as string[],
    platforms: [] as string[],
    releases: [] as string[],
  };

  const environment = resolveScopedQueryValue(rawEnv, options.environments);
  if (rawEnv !== environment) {
    redirect(mergeListQuery(ERRORS_PATH, currentParams, { environment }));
  }

  const release = resolveScopedQueryValue(rawRelease, options.releases);
  if (rawRelease !== release) {
    redirect(mergeListQuery(ERRORS_PATH, currentParams, { release }));
  }

  const platform = resolveScopedQueryValue(rawPlatform, options.platforms);
  if (rawPlatform !== platform) {
    redirect(mergeListQuery(ERRORS_PATH, currentParams, { platform }));
  }

  const initialListParams = Object.fromEntries(apiQuery.entries());
  const effectiveSort = sort ?? "last_seen";
  const effectiveOrder = order ?? "desc";

  return (
    <>
      <PageTitle
        title="Issues"
        context={
          appFilter
            ? `${timeRange.label} · App: ${appFilter}`
            : `${timeRange.label} · Grouped errors with status, frequency, and stack traces.`
        }
      />

      <AnalyticsListShell>
        {summary ? <ErrorsSummaryMetrics summary={summary} /> : null}

        <ErrorsClientListSection
          path={ERRORS_PATH}
          urlParams={currentParams}
          initialListParams={initialListParams}
          initialData={initialListData}
          timeRange={timeRange}
          fromParam={from}
          toParam={to}
          trendTimeRange={trendTimeRange}
          trendFromParam={trendFrom}
          trendToParam={trendTo}
          appFilter={appFilter}
          pageSize={String(pageSize)}
          defaultPageSize={DEFAULT_LIST_PAGE_SIZE}
          q={q ?? ""}
          environment={environment ?? ""}
          platform={platform ?? ""}
          release={release ?? ""}
          status={status ?? "all"}
          sort={effectiveSort}
          order={effectiveOrder}
          environments={options.environments}
          platforms={options.platforms}
          releases={options.releases}
        />

        <DeferredErrorsAnalytics queryString={summaryQuery.toString()} />
      </AnalyticsListShell>
    </>
  );
}
