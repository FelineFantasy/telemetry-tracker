import { PageTitle } from "@/app/components/PageTitle";
import { redirect } from "next/navigation";
import { EventsListToolbar } from "@/app/components/dashboard/EventsListToolbar";
import { effectiveListRange } from "@/lib/list-filters-url";
import { ListResultCount } from "@/app/components/dashboard/ListResultCount";
import { EmptyState } from "@/app/components/EmptyState";
import { TimeAgo } from "@/app/components/TimeAgo";
import { ErrorState } from "@/app/components/ErrorState";
import { Pagination } from "@/app/components/ui/Pagination";
import { Table, TableListLink, TablePropertiesCell, TableViewLink, TableWrap } from "@/app/components/ui/Table";
import { mergeListQuery } from "@/lib/list-filters-url";
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

type EventRow = {
  id: string;
  name: string;
  properties?: unknown;
  created_at: string;
};

async function getEvents(search: URLSearchParams) {
  const res = await dashboardApiFetch(`/api/events?${search.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<{
    items: EventRow[];
    total: number;
    page: number;
    pageSize: number;
  }>;
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
  const currentParams = buildEventsParamsRecord(sp);
  const appFilter = firstQueryValue(sp.app) ?? "";
  const rawEnv = firstQueryValue(sp.environment)?.trim() || null;
  const filterOptions = await getFilterOptions(appFilter || undefined);
  const environment = resolveScopedQueryValue(rawEnv, filterOptions.environments);
  if (rawEnv !== environment) {
    redirect(mergeListQuery(EVENTS_PATH, currentParams, { environment }));
  }

  const page = parsePageParam(firstQueryValue(sp.page));
  const pageSize = parsePageSizeParam(
    firstQueryValue(sp.pageSize),
    firstQueryValue(sp.limit)
  );
  const rangeEff = effectiveListRange(
    {
      range: firstQueryValue(sp.range),
      from: firstQueryValue(sp.from),
      to: firstQueryValue(sp.to),
    },
    "all"
  );

  const apiQuery = new URLSearchParams();
  if (appFilter) apiQuery.set("app", appFilter);
  apiQuery.set("page", String(page));
  apiQuery.set("pageSize", String(pageSize));
  const r = firstQueryValue(sp.range);
  const from = firstQueryValue(sp.from);
  const to = firstQueryValue(sp.to);
  const name = firstQueryValue(sp.name);
  const platform = firstQueryValue(sp.platform);
  const release = firstQueryValue(sp.release);
  const propertiesContains = firstQueryValue(sp.propertiesContains);
  const sort = firstQueryValue(sp.sort);
  const order = firstQueryValue(sp.order);
  if (r) apiQuery.set("range", r);
  if (from) apiQuery.set("from", from);
  if (to) apiQuery.set("to", to);
  if (name) apiQuery.set("name", name);
  if (environment) apiQuery.set("environment", environment);
  if (platform) apiQuery.set("platform", platform);
  if (release) apiQuery.set("release", release);
  if (propertiesContains) apiQuery.set("propertiesContains", propertiesContains);
  if (sort) apiQuery.set("sort", sort);
  if (order) apiQuery.set("order", order);

  let items: EventRow[] = [];
  let total = 0;
  try {
    const data = await getEvents(apiQuery);
    items = data.items ?? [];
    total = resolveApiListTotal(data.total, items.length);
  } catch (e) {
    return (
      <>
        <PageTitle title="Events" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const hrefForPage = (p: number) =>
    mergeListQuery(EVENTS_PATH, currentParams, { page: String(p) });

  const contextParts = [];
  if (appFilter) contextParts.push(`App: ${appFilter}`);
  if (firstQueryValue(sp.name)) contextParts.push(`Event: ${firstQueryValue(sp.name)}`);

  return (
    <>
      <PageTitle
        title="Events"
        context={
          contextParts.length > 0
            ? contextParts.join(" · ")
            : "Product and analytics events recorded by your SDK."
        }
      />

      <EventsListToolbar
        path={EVENTS_PATH}
        currentParams={currentParams}
        activePreset={rangeEff.activePreset}
        customRange={rangeEff.customRange}
        rangePreset={r ?? ""}
        appFilter={appFilter}
        pageSize={String(pageSize)}
        defaultPageSize={DEFAULT_LIST_PAGE_SIZE}
        from={from ?? ""}
        to={to ?? ""}
        name={name ?? ""}
        environment={environment ?? ""}
        platform={platform ?? ""}
        release={release ?? ""}
        propertiesContains={propertiesContains ?? ""}
        sort={sort ?? "created_at"}
        order={order ?? "desc"}
        environments={filterOptions.environments}
        platforms={filterOptions.platforms}
        releases={filterOptions.releases}
      />

      <p className="mb-4 text-sm text-muted-foreground">
        Properties search matches raw JSON text (useful for known keys or values).
      </p>

      <ListResultCount total={total} noun={total === 1 ? "event" : "events"} />

      {items.length ? (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Properties</th>
                <th>When</th>
                <th aria-hidden>View</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td>
                    <TableListLink
                      href={
                        appFilter
                          ? `/dashboard/events/${e.id}?app=${encodeURIComponent(appFilter)}`
                          : `/dashboard/events/${e.id}`
                      }
                    >
                      {e.name}
                    </TableListLink>
                  </td>
                  <td className="max-w-md">
                    <TablePropertiesCell data={e.properties} />
                  </td>
                  <td>
                    <TimeAgo iso={e.created_at} />
                  </td>
                  <td>
                    <TableViewLink
                      href={
                        appFilter
                          ? `/dashboard/events/${e.id}?app=${encodeURIComponent(appFilter)}`
                          : `/dashboard/events/${e.id}`
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      ) : (
        <EmptyState
          title="No events recorded"
          message={
            appFilter || firstQueryValue(sp.name)
              ? "No events match these filters. Try adjusting the name filter or date range."
              : "No events have been recorded yet. Instrument your app and send events to see them here."
          }
        />
      )}
      <Pagination total={total} page={page} pageSize={pageSize} hrefForPage={hrefForPage} />
    </>
  );
}
