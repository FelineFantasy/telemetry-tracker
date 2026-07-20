import { PageTitle } from "@/app/components/PageTitle";
import { redirect } from "next/navigation";
import { PerformanceListToolbar } from "@/app/components/dashboard/PerformanceListToolbar";
import { PerformanceRatingDistribution } from "@/app/components/dashboard/PerformanceRatingDistribution";
import { PerformanceSlowPagesTable } from "@/app/components/dashboard/PerformanceSlowPagesTable";
import { PerformanceSlowRoutesTable } from "@/app/components/dashboard/PerformanceSlowRoutesTable";
import { PerformanceSummaryMetrics } from "@/app/components/dashboard/PerformanceSummaryMetrics";
import { PerformanceVitalsChart } from "@/app/components/dashboard/PerformanceVitalsChart";
import { AnalyticsListShell } from "@/app/components/dashboard/analytics-ui";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { dashboardApiFetch } from "@/lib/dashboard-api";
import { mergeListQuery } from "@/lib/list-filters-url";
import {
  fetchPerformanceSummary,
  fetchSlowPages,
  fetchSlowRoutes,
} from "@/lib/performance-summary";
import { redirectHrefIfMissingTimeRange, redirectHrefForMetricsUntil } from "@/lib/list-filters-url";
import {
  appendListTimeRangeToParams,
  isUnselectedTimeRange,
  parseListTimeRangeOrDefault,
  resolveMetricsUntilIso,
} from "@/lib/time-range";
import {
  DEFAULT_LIST_PAGE_SIZE,
  parsePageParam,
  parsePageSizeParam,
} from "@/lib/pagination";
import { firstQueryValue } from "@/lib/search-params";
import type { DashboardListScope } from "@/lib/overview-scope-url";

const PERFORMANCE_PATH = "/dashboard/performance";
const TABLE_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

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

function buildPerformanceParamsRecord(sp: Record<string, string | string[] | undefined>) {
  const keys = [
    "app",
    "range",
    "from",
    "to",
    "metricsUntil",
    "environment",
    "platform",
    "release",
    "chartBucket",
    "routesPage",
    "pagesPage",
    "compare",
    "compareFrom",
    "compareTo",
  ] as const;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = firstQueryValue(sp[k]);
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

function chartRangeLabel(summary: NonNullable<Awaited<ReturnType<typeof fetchPerformanceSummary>>>): string {
  const chartSinceMs = new Date(summary.chartWindow.since).getTime();
  const windowSinceMs = new Date(summary.window.since).getTime();
  if (chartSinceMs <= windowSinceMs) {
    return summary.window.label;
  }
  return `${summary.window.label} (recent chart)`;
}

function buildScopeApiQuery(
  sp: Record<string, string | string[] | undefined>,
  timeRange: ReturnType<typeof parseListTimeRangeOrDefault>,
  from: string,
  to: string,
  pageAnchorIso: string | null
): URLSearchParams {
  const apiQuery = new URLSearchParams();
  const appFilter = firstQueryValue(sp.app) ?? "";
  if (appFilter) apiQuery.set("app", appFilter);
  appendListTimeRangeToParams(apiQuery, timeRange, from, to);
  const platform = firstQueryValue(sp.platform);
  const environment = firstQueryValue(sp.environment);
  const release = firstQueryValue(sp.release);
  const chartBucket = firstQueryValue(sp.chartBucket);
  const compare = firstQueryValue(sp.compare);
  const compareFrom = firstQueryValue(sp.compareFrom);
  const compareTo = firstQueryValue(sp.compareTo);
  if (platform) apiQuery.set("platform", platform);
  if (environment) apiQuery.set("environment", environment);
  if (release) apiQuery.set("release", release);
  if (chartBucket) apiQuery.set("chartBucket", chartBucket);
  if (compare) apiQuery.set("compare", compare);
  if (compareFrom) apiQuery.set("compareFrom", compareFrom);
  if (compareTo) apiQuery.set("compareTo", compareTo);
  if (pageAnchorIso) apiQuery.set("metricsUntil", pageAnchorIso);
  return apiQuery;
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  let currentParams = buildPerformanceParamsRecord(sp);
  const defaultTimeHref = redirectHrefIfMissingTimeRange(PERFORMANCE_PATH, currentParams);
  if (defaultTimeHref) redirect(defaultTimeHref);
  const appFilter = firstQueryValue(sp.app) ?? "";
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
    PERFORMANCE_PATH,
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

  const routesPage = parsePageParam(sp.routesPage);
  const pagesPage = parsePageParam(sp.pagesPage);
  const tablePageSize = parsePageSizeParam(undefined, undefined, TABLE_PAGE_SIZE);

  const apiQuery = buildScopeApiQuery(sp, timeRange, from, to, pageAnchorIso);
  const routesQuery = new URLSearchParams(apiQuery);
  routesQuery.set("page", String(routesPage));
  routesQuery.set("pageSize", String(tablePageSize));
  const pagesQuery = new URLSearchParams(apiQuery);
  pagesQuery.set("page", String(pagesPage));
  pagesQuery.set("pageSize", String(tablePageSize));

  const platform = firstQueryValue(sp.platform);
  const environment = firstQueryValue(sp.environment);
  const release = firstQueryValue(sp.release);
  const chartBucket = firstQueryValue(sp.chartBucket);

  let summary: Awaited<ReturnType<typeof fetchPerformanceSummary>> = null;
  let slowRoutes: Awaited<ReturnType<typeof fetchSlowRoutes>> = null;
  let slowPages: Awaited<ReturnType<typeof fetchSlowPages>> = null;
  let environments: string[] = [];
  let platforms: string[] = [];
  let releases: string[] = [];
  let tablesError: string | null = null;

  try {
    const [summaryData, routesData, pagesData, opts] = await Promise.all([
      fetchPerformanceSummary(apiQuery),
      fetchSlowRoutes(routesQuery),
      fetchSlowPages(pagesQuery),
      getFilterOptions(appFilter || undefined),
    ]);
    summary = summaryData;
    slowRoutes = routesData;
    slowPages = pagesData;
    environments = opts.environments;
    platforms = opts.platforms;
    releases = opts.releases;
    if (!routesData || !pagesData) {
      tablesError = "Could not load slow routes or slow pages.";
    }
  } catch (e) {
    return (
      <>
        <PageTitle title="Performance" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const metricsRangeLabel = summary?.window.label ?? timeRange.label;
  const hasVitals = summary?.webVitals.available === true;
  const hasRequestLatency = summary?.requestLatency.available === true;
  const listScope: DashboardListScope = {
    app: appFilter || null,
    environment: environment || null,
    platform: platform || null,
    release: release || null,
    range: firstQueryValue(sp.range) ?? null,
    from: from || null,
    to: to || null,
    ...(pageAnchorIso ? { metricsUntil: pageAnchorIso } : {}),
    compare: firstQueryValue(sp.compare) ?? null,
    compareFrom: firstQueryValue(sp.compareFrom) ?? null,
    compareTo: firstQueryValue(sp.compareTo) ?? null,
  };

  const showSummary = Boolean(summary && (hasVitals || hasRequestLatency));
  const showTables = Boolean(slowRoutes || slowPages);

  return (
    <>
      <PageTitle
        title="Performance"
        context={
          appFilter
            ? `${metricsRangeLabel} · App: ${appFilter}`
            : `${metricsRangeLabel} · Web vitals and request latency for your apps.`
        }
      />

      <AnalyticsListShell>
        <PerformanceListToolbar
          path={PERFORMANCE_PATH}
          currentParams={currentParams}
          timeRange={timeRange}
          fromParam={from}
          toParam={to}
          appFilter={appFilter}
          environment={environment ?? ""}
          platform={platform ?? ""}
          release={release ?? ""}
          chartBucket={chartBucket ?? ""}
          environments={environments}
          platforms={platforms}
          releases={releases}
        />

        {!summary ? (
          <ErrorState message="Could not load performance summary." />
        ) : showSummary ? (
          <>
            <PerformanceSummaryMetrics summary={summary} />
            {hasVitals ? (
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <PerformanceVitalsChart
                  summary={summary}
                  rangeLabel={chartRangeLabel(summary)}
                  path={PERFORMANCE_PATH}
                  currentParams={currentParams}
                />
                <PerformanceRatingDistribution
                  summary={summary}
                  rangeLabel={summary.window.label}
                />
              </section>
            ) : (
              <EmptyState
                title="No web vitals yet"
                message="Send `$web_vital` events from the Telemetry SDK (browser or supported runtimes) to see LCP, INP, CLS, and TTFB here. Request latency metrics are shown above from `$request` events."
              />
            )}
          </>
        ) : (
          <EmptyState
            title="No performance data yet"
            message="Enable web vitals in your SDK to capture LCP, INP, CLS, and TTFB, or instrument server `$request` events for response-time metrics."
          />
        )}

        {tablesError ? <ErrorState message={tablesError} /> : null}

        {showTables ? (
          <section className="grid gap-4 lg:grid-cols-1 xl:grid-cols-2">
            {slowRoutes ? (
              <PerformanceSlowRoutesTable
                items={slowRoutes.items}
                total={slowRoutes.total}
                page={slowRoutes.page}
                pageSize={slowRoutes.pageSize}
                scope={listScope}
                metricsWindow={slowRoutes.window}
                rangeLabel={slowRoutes.window.label}
                hrefForPage={(p) =>
                  mergeListQuery(PERFORMANCE_PATH, currentParams, {
                    routesPage: String(p),
                  })
                }
              />
            ) : null}
            {slowPages ? (
              <PerformanceSlowPagesTable
                items={slowPages.items}
                total={slowPages.total}
                page={slowPages.page}
                pageSize={slowPages.pageSize}
                scope={listScope}
                metricsWindow={slowPages.window}
                rangeLabel={slowPages.window.label}
                hrefForPage={(p) =>
                  mergeListQuery(PERFORMANCE_PATH, currentParams, {
                    pagesPage: String(p),
                  })
                }
              />
            ) : null}
          </section>
        ) : null}
      </AnalyticsListShell>
    </>
  );
}
