import { PageTitle } from "@/app/components/PageTitle";
import { redirect } from "next/navigation";
import { EventsClientListSection } from "@/app/components/dashboard/EventsClientListSection";
import { EventsSummaryMetrics, type EventsPageSummary } from "@/app/components/dashboard/EventsSummaryMetrics";
import { DeferredEventsAnalytics } from "@/app/components/dashboard/DeferredEventsAnalytics";
import { type EventsTableRow } from "@/app/components/dashboard/EventsTable";
import { mergeListQuery, redirectHrefIfMissingTimeRange, redirectHrefForMetricsUntil } from "@/lib/list-filters-url";
import {
  appendListTimeRangeToParams,
  isUnselectedTimeRange,
  parseListTimeRangeOrDefault,
  resolveMetricsUntilIso,
} from "@/lib/time-range";
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

const EVENTS_PATH = "/dashboard/events";

type EventNameRow = EventsTableRow;

async function getEvents(search: URLSearchParams) {
  const res = await dashboardApiFetch(`/api/events?${search.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<{
    items: EventNameRow[];
    total: number;
    page: number;
    pageSize: number;
  }>;
}

async function getEventsSummary(search: URLSearchParams): Promise<EventsPageSummary | null> {
  const res = await dashboardApiFetch(`/api/events/summary?${search.toString()}`);
  if (!res.ok) return null;
  return res.json();
}

async function getFilterOptions(app?: string) {
  const p = new URLSearchParams();
  if (app) p.set("app", app);
  const res = await dashboardApiFetch(`/api/filter-options?${p.toString()}`);
  if (!res.ok) {
    return { environments: [] as string[], platforms: [] as string[], releases: [] as string[] };
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

function buildEventsParamsRecord(sp: Record<string, string | string[] | undefined>) {
  const keys = [
    "app",
    "page",
    "pageSize",
    "limit",
    "range",
    "from",
    "to",
    "metricsUntil",
    "name",
    "environment",
    "platform",
    "release",
    "propertiesContains",
    "q",
    "sort",
    "order",
  ] as const;
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = firstQueryValue(sp[k]);
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  let currentParams = buildEventsParamsRecord(sp);
  const defaultTimeHref = redirectHrefIfMissingTimeRange(EVENTS_PATH, currentParams);
  if (defaultTimeHref) redirect(defaultTimeHref);
  const appFilter = firstQueryValue(sp.app) ?? "";
  const rawEnv = firstQueryValue(sp.environment)?.trim() || null;

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
    EVENTS_PATH,
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
  apiQuery.set("view", "grouped");
  const name = firstQueryValue(sp.name);
  const platform = firstQueryValue(sp.platform);
  const release = firstQueryValue(sp.release);
  const propertiesContains = firstQueryValue(sp.propertiesContains);
  const q = firstQueryValue(sp.q);
  const sort = firstQueryValue(sp.sort);
  const order = firstQueryValue(sp.order);
  appendListTimeRangeToParams(apiQuery, timeRange, from, to);
  if (name) apiQuery.set("name", name);
  if (rawEnv) apiQuery.set("environment", rawEnv);
  if (platform) apiQuery.set("platform", platform);
  if (release) apiQuery.set("release", release);
  if (propertiesContains) apiQuery.set("propertiesContains", propertiesContains);
  if (q) apiQuery.set("q", q);
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
  summaryQuery.delete("view");

  let initialListData: {
    items: EventNameRow[];
    total: number;
    page: number;
    pageSize: number;
  };
  let summary: EventsPageSummary | null = null;
  let filterOptions: {
    environments: string[];
    platforms: string[];
    releases: string[];
  };

  try {
    const [opts, data, summaryData] = await Promise.all([
      getFilterOptions(appFilter || undefined),
      getEvents(apiQuery),
      getEventsSummary(summaryQuery),
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
        <PageTitle title="Events" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const environment = resolveScopedQueryValue(rawEnv, filterOptions.environments);
  if (rawEnv !== environment) {
    redirect(mergeListQuery(EVENTS_PATH, currentParams, { environment }));
  }

  const initialListParams = Object.fromEntries(apiQuery.entries());
  const effectiveSort = sort ?? "last_seen";
  const effectiveOrder = order ?? "desc";

  const contextParts = [timeRange.label];
  if (appFilter) contextParts.push(`App: ${appFilter}`);
  if (name) contextParts.push(`Event: ${name}`);

  return (
    <>
      <PageTitle
        title="Events"
        context={
          contextParts.length > 0
            ? contextParts.join(" · ")
            : "Product and analytics events grouped by name."
        }
      />

      <AnalyticsListShell>
        {summary ? <EventsSummaryMetrics summary={summary} /> : null}

        <EventsClientListSection
          path={EVENTS_PATH}
          urlParams={currentParams}
          initialListParams={initialListParams}
          initialData={initialListData}
          timeRange={timeRange}
          fromParam={from}
          toParam={to}
          appFilter={appFilter}
          pageSize={String(pageSize)}
          defaultPageSize={DEFAULT_LIST_PAGE_SIZE}
          name={name ?? ""}
          environment={environment ?? ""}
          platform={platform ?? ""}
          release={release ?? ""}
          propertiesContains={propertiesContains ?? ""}
          q={q ?? ""}
          sort={effectiveSort}
          order={effectiveOrder}
          environments={filterOptions.environments}
          platforms={filterOptions.platforms}
          releases={filterOptions.releases}
        />

        <DeferredEventsAnalytics queryString={summaryQuery.toString()} />
      </AnalyticsListShell>
    </>
  );
}
