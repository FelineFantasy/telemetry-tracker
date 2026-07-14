import { PageTitle } from "@/app/components/PageTitle";
import { redirect } from "next/navigation";
import { SessionsListToolbar } from "@/app/components/dashboard/SessionsListToolbar";
import {
  SessionsSummaryMetrics,
  type SessionsPageSummary,
} from "@/app/components/dashboard/SessionsSummaryMetrics";
import {
  SessionsAnalyticsPanels,
  type SessionsAnalyticsData,
} from "@/app/components/dashboard/SessionsAnalyticsPanels";
import {
  SessionsTable,
  type SessionsTableRow,
} from "@/app/components/dashboard/SessionsTable";
import { mergeListQuery, redirectHrefIfMissingTimeRange } from "@/lib/list-filters-url";
import { appendListTimeRangeToParams, isUnselectedTimeRange, parseListTimeRangeOrDefault } from "@/lib/time-range";
import { ListResultCount } from "@/app/components/dashboard/ListResultCount";
import { AnalyticsListShell } from "@/app/components/dashboard/analytics-ui";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { Pagination } from "@/app/components/ui/Pagination";
import {
  DEFAULT_LIST_PAGE_SIZE,
  parsePageParam,
  parsePageSizeParam,
  resolveApiListTotal,
} from "@/lib/pagination";
import { firstQueryValue } from "@/lib/search-params";
import { dashboardApiFetch } from "@/lib/dashboard-api";

const SESSIONS_PATH = "/dashboard/sessions";

async function getSessions(search: URLSearchParams) {
  const res = await dashboardApiFetch(`/api/sessions?${search.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<{
    items: SessionsTableRow[];
    total: number;
    page: number;
    pageSize: number;
    max_duration_sec?: number;
  }>;
}

async function getSessionsSummary(search: URLSearchParams): Promise<SessionsPageSummary | null> {
  const res = await dashboardApiFetch(`/api/sessions/summary?${search.toString()}`);
  if (!res.ok) return null;
  return res.json();
}

async function getSessionsAnalytics(search: URLSearchParams): Promise<SessionsAnalyticsData | null> {
  const res = await dashboardApiFetch(`/api/sessions/analytics?${search.toString()}`);
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
      countries: [] as string[],
    };
  }
  const data = (await res.json()) as {
    environments?: string[];
    platforms?: string[];
    releases?: string[];
    countries?: string[];
  };
  return {
    environments: data.environments ?? [],
    platforms: data.platforms ?? [],
    releases: data.releases ?? [],
    countries: data.countries ?? [],
  };
}

function buildSessionsParamsRecord(sp: Record<string, string | string[] | undefined>) {
  const keys = [
    "app",
    "page",
    "pageSize",
    "limit",
    "range",
    "from",
    "to",
    "q",
    "environment",
    "release",
    "country",
    "platform",
    "sort",
    "order",
    "chartBucket",
  ] as const;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = firstQueryValue(sp[k]);
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const currentParams = buildSessionsParamsRecord(sp);
  const defaultTimeHref = redirectHrefIfMissingTimeRange(SESSIONS_PATH, currentParams);
  if (defaultTimeHref) redirect(defaultTimeHref);
  const appFilter = firstQueryValue(sp.app) ?? "";
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

  const apiQuery = new URLSearchParams();
  if (appFilter) apiQuery.set("app", appFilter);
  apiQuery.set("page", String(page));
  apiQuery.set("pageSize", String(pageSize));
  appendListTimeRangeToParams(apiQuery, timeRange, from, to);
  const platform = firstQueryValue(sp.platform);
  const environment = firstQueryValue(sp.environment);
  const release = firstQueryValue(sp.release);
  const country = firstQueryValue(sp.country);
  const q = firstQueryValue(sp.q);
  const sort = firstQueryValue(sp.sort);
  const order = firstQueryValue(sp.order);
  const chartBucket = firstQueryValue(sp.chartBucket);
  if (platform) apiQuery.set("platform", platform);
  if (environment) apiQuery.set("environment", environment);
  if (release) apiQuery.set("release", release);
  if (country) apiQuery.set("country", country);
  if (q) apiQuery.set("q", q);
  if (sort) apiQuery.set("sort", sort);
  if (order) apiQuery.set("order", order);
  if (chartBucket) apiQuery.set("chartBucket", chartBucket);

  const pageAnchor = new Date();
  if (isUnselectedTimeRange(timeRange.key)) {
    apiQuery.set("metricsUntil", pageAnchor.toISOString());
  }

  const summaryQuery = new URLSearchParams(apiQuery);
  summaryQuery.delete("page");
  summaryQuery.delete("pageSize");
  summaryQuery.delete("sort");
  summaryQuery.delete("order");

  let items: SessionsTableRow[] = [];
  let total = 0;
  let maxDurationSec = 0;
  let summary: SessionsPageSummary | null = null;
  let analytics: SessionsAnalyticsData | null = null;
  let platforms: string[] = [];
  let environments: string[] = [];
  let releases: string[] = [];
  let countries: string[] = [];
  try {
    const [data, opts, summaryData, analyticsData] = await Promise.all([
      getSessions(apiQuery),
      getFilterOptions(appFilter || undefined),
      getSessionsSummary(summaryQuery),
      getSessionsAnalytics(summaryQuery),
    ]);
    items = data.items ?? [];
    total = resolveApiListTotal(data.total, items.length);
    maxDurationSec = data.max_duration_sec ?? 0;
    platforms = opts.platforms;
    environments = opts.environments;
    releases = opts.releases;
    countries = opts.countries;
    summary = summaryData;
    analytics = analyticsData;
  } catch (e) {
    return (
      <>
        <PageTitle title="Sessions" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const hrefForPage = (p: number) =>
    mergeListQuery(SESSIONS_PATH, currentParams, { page: String(p) });

  const effectiveSort = sort ?? "duration";
  const effectiveOrder = order ?? "desc";
  const listSubtitle =
    page === 1 && effectiveSort === "duration" && effectiveOrder === "desc"
      ? "Showing top sessions by duration"
      : undefined;

  const sessionHref = (row: SessionsTableRow) =>
    appFilter
      ? `/dashboard/sessions/${row.id}?app=${encodeURIComponent(appFilter)}`
      : `/dashboard/sessions/${row.id}`;

  const rangeLabel = timeRange.label;

  return (
    <>
      <PageTitle
        title="Sessions"
        context={
          appFilter
            ? `${rangeLabel} · App: ${appFilter}`
            : `${rangeLabel} · User sessions with device and duration metadata.`
        }
      />

      <AnalyticsListShell>
        {summary ? <SessionsSummaryMetrics summary={summary} /> : null}

        {analytics ? (
          <SessionsAnalyticsPanels
            analytics={analytics}
            path={SESSIONS_PATH}
            currentParams={currentParams}
          />
        ) : null}

        <SessionsListToolbar
        path={SESSIONS_PATH}
        currentParams={currentParams}
        timeRange={timeRange}
        fromParam={from}
        toParam={to}
        appFilter={appFilter}
        pageSize={String(pageSize)}
        defaultPageSize={DEFAULT_LIST_PAGE_SIZE}
        q={q ?? ""}
        environment={environment ?? ""}
        release={release ?? ""}
        country={country ?? ""}
        platform={platform ?? ""}
        sort={effectiveSort}
        order={effectiveOrder}
        environments={environments}
        releases={releases}
        countries={countries}
        platforms={platforms}
        />

        <ListResultCount
          total={total}
          noun={total === 1 ? "session" : "sessions"}
          subtitle={listSubtitle}
        />

        {items.length ? (
          <SessionsTable
            rows={items}
            hrefForSession={sessionHref}
            hrefForView={sessionHref}
            maxDurationSec={maxDurationSec}
          />
      ) : (
        <EmptyState
          title="No sessions recorded"
          message={
            appFilter
              ? `No sessions for app "${appFilter}" with these filters.`
              : `No sessions match ${rangeLabel}. Try another range or clear filters.`
          }
        />
        )}
        <Pagination total={total} page={page} pageSize={pageSize} hrefForPage={hrefForPage} />
      </AnalyticsListShell>
    </>
  );
}
