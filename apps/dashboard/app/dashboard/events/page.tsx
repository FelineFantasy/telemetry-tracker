import { PageTitle } from "@/app/components/PageTitle";
import { redirect } from "next/navigation";
import { EventsListToolbar } from "@/app/components/dashboard/EventsListToolbar";
import { EventsSummaryMetrics, type EventsPageSummary } from "@/app/components/dashboard/EventsSummaryMetrics";
import {
  EventsAnalyticsPanels,
  type EventsAnalyticsData,
} from "@/app/components/dashboard/EventsAnalyticsPanels";
import { EventsTable } from "@/app/components/dashboard/EventsTable";
import { mergeListQuery } from "@/lib/list-filters-url";
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
import { resolveScopedQueryValue } from "@/lib/overview-scope-url";
import { dashboardApiFetch } from "@/lib/dashboard-api";

const EVENTS_PATH = "/dashboard/events";

type EventNameRow = {
  name: string;
  app: string;
  platform?: string | null;
  environment?: string | null;
  count_in_range: number;
  share_pct: number;
  users_affected?: number;
  last_seen: string;
  latest_event_id?: string | null;
  capture_kind?: "auto" | "custom";
  sparkline?: { t: string; count: number }[];
};

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

async function getEventsAnalytics(search: URLSearchParams): Promise<EventsAnalyticsData | null> {
  const res = await dashboardApiFetch(`/api/events/analytics?${search.toString()}`);
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
    "name",
    "environment",
    "platform",
    "release",
    "propertiesContains",
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
  const pageAnchor = new Date();
  const currentParams = buildEventsParamsRecord(sp);
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

  const apiQuery = new URLSearchParams();
  if (appFilter) apiQuery.set("app", appFilter);
  apiQuery.set("page", String(page));
  apiQuery.set("pageSize", String(pageSize));
  apiQuery.set("view", "grouped");
  const name = firstQueryValue(sp.name);
  const platform = firstQueryValue(sp.platform);
  const release = firstQueryValue(sp.release);
  const propertiesContains = firstQueryValue(sp.propertiesContains);
  const sort = firstQueryValue(sp.sort);
  const order = firstQueryValue(sp.order);
  appendListTimeRangeToParams(apiQuery, timeRange, from, to);
  if (name) apiQuery.set("name", name);
  if (rawEnv) apiQuery.set("environment", rawEnv);
  if (platform) apiQuery.set("platform", platform);
  if (release) apiQuery.set("release", release);
  if (propertiesContains) apiQuery.set("propertiesContains", propertiesContains);
  if (sort) apiQuery.set("sort", sort);
  if (order) apiQuery.set("order", order);
  if (isUnselectedTimeRange(timeRange.key)) {
    apiQuery.set("metricsUntil", pageAnchor.toISOString());
  }

  const summaryQuery = new URLSearchParams(apiQuery);
  summaryQuery.delete("page");
  summaryQuery.delete("pageSize");
  summaryQuery.delete("sort");
  summaryQuery.delete("order");
  summaryQuery.delete("view");

  let items: EventNameRow[] = [];
  let total = 0;
  let summary: EventsPageSummary | null = null;
  let analytics: EventsAnalyticsData | null = null;
  let filterOptions = {
    environments: [] as string[],
    platforms: [] as string[],
    releases: [] as string[],
  };

  try {
    const [opts, data, summaryData, analyticsData] = await Promise.all([
      getFilterOptions(appFilter || undefined),
      getEvents(apiQuery),
      getEventsSummary(summaryQuery),
      getEventsAnalytics(summaryQuery),
    ]);
    filterOptions = opts;
    items = data.items ?? [];
    total = resolveApiListTotal(data.total, items.length);
    summary = summaryData;
    analytics = analyticsData;
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

  const hrefForPage = (p: number) =>
    mergeListQuery(EVENTS_PATH, currentParams, { page: String(p) });

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

        {analytics ? <EventsAnalyticsPanels analytics={analytics} /> : null}

        <EventsListToolbar
          path={EVENTS_PATH}
          currentParams={currentParams}
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
          sort={sort ?? "last_seen"}
          order={order ?? "desc"}
          environments={filterOptions.environments}
          platforms={filterOptions.platforms}
          releases={filterOptions.releases}
        />

        <p className="text-sm text-muted-foreground">
          Properties search matches raw JSON text (useful for known keys or values).
        </p>

        <ListResultCount
          total={total}
          noun={total === 1 ? "event name" : "event names"}
        />

        {items.length ? (
          <EventsTable
            rows={items}
            hrefForName={(row) =>
              mergeListQuery(EVENTS_PATH, currentParams, { name: row.name, page: "1" })
            }
            hrefForView={(row) => {
              if (!row.latest_event_id) return null;
              return appFilter
                ? `/dashboard/events/${row.latest_event_id}?app=${encodeURIComponent(appFilter)}`
                : `/dashboard/events/${row.latest_event_id}`;
            }}
          />
        ) : (
          <EmptyState
            title="No events recorded"
            message={
              appFilter || name
                ? "No event names match these filters. Try adjusting the name filter or date range."
                : "No events have been recorded yet. Instrument your app and send events to see them here."
            }
          />
        )}
        <Pagination total={total} page={page} pageSize={pageSize} hrefForPage={hrefForPage} />
      </AnalyticsListShell>
    </>
  );
}
