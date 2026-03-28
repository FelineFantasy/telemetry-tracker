const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "@/app/components/PageTitle";
import { CustomDateRangeForm } from "@/app/components/dashboard/CustomDateRangeForm";
import { DateRangeShortcuts, effectiveListRange } from "@/app/components/dashboard/DateRangeShortcuts";
import { ListResultCount } from "@/app/components/dashboard/ListResultCount";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { Pagination } from "@/app/components/ui/Pagination";
import { Table, TableListLink, TableWrap } from "@/app/components/ui/Table";
import { mergeListQuery } from "@/lib/list-filters-url";
import {
  DEFAULT_LIST_PAGE_SIZE,
  parsePageParam,
  parsePageSizeParam,
  resolveApiListTotal,
} from "@/lib/pagination";
import { firstQueryValue } from "@/lib/search-params";
import Link from "next/link";

const EVENTS_PATH = "/dashboard/events";

type EventRow = {
  id: string;
  name: string;
  properties?: unknown;
  created_at: string;
};

async function getEvents(search: URLSearchParams) {
  const res = await fetch(`${API_BASE}/api/events?${search.toString()}`, {
    cache: "no-store",
  });
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
  const res = await fetch(`${API_BASE}/api/filter-options?${p.toString()}`, {
    cache: "no-store",
  });
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
  const appFilter = firstQueryValue(sp.app) ?? "";
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
  const environment = firstQueryValue(sp.environment);
  const platform = firstQueryValue(sp.platform);
  const release = firstQueryValue(sp.release);
  const propertiesContains = firstQueryValue(sp.propertiesContains);
  if (r) apiQuery.set("range", r);
  if (from) apiQuery.set("from", from);
  if (to) apiQuery.set("to", to);
  if (name) apiQuery.set("name", name);
  if (environment) apiQuery.set("environment", environment);
  if (platform) apiQuery.set("platform", platform);
  if (release) apiQuery.set("release", release);
  if (propertiesContains) apiQuery.set("propertiesContains", propertiesContains);

  let items: EventRow[] = [];
  let total = 0;
  let opts = { environments: [] as string[], platforms: [] as string[], releases: [] as string[] };
  try {
    const [data, filterOpts] = await Promise.all([
      getEvents(apiQuery),
      getFilterOptions(appFilter || undefined),
    ]);
    items = data.items ?? [];
    total = resolveApiListTotal(data.total, items.length);
    opts = filterOpts;
  } catch (e) {
    return (
      <>
        <PageTitle title="Events" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const currentParams = buildEventsParamsRecord(sp);
  const hrefForPage = (p: number) =>
    mergeListQuery(EVENTS_PATH, currentParams, { page: String(p) });

  const hiddenForCustomDates: Record<string, string> = { ...currentParams };
  delete hiddenForCustomDates.from;
  delete hiddenForCustomDates.to;
  delete hiddenForCustomDates.page;
  delete hiddenForCustomDates.range;

  const contextParts = [];
  if (appFilter) contextParts.push(`App: ${appFilter}`);
  if (firstQueryValue(sp.name)) contextParts.push(`Event: ${firstQueryValue(sp.name)}`);
  const context =
    contextParts.length > 0 ? contextParts.join(" · ") : "All events";

  return (
    <>
      <PageTitle title="Events" context={context} />

      <div className="filter-toolbar">
        <DateRangeShortcuts
          path={EVENTS_PATH}
          currentParams={currentParams}
          activePreset={rangeEff.activePreset}
          customRange={rangeEff.customRange}
        />
        <CustomDateRangeForm
          path={EVENTS_PATH}
          hiddenParams={hiddenForCustomDates}
          from={firstQueryValue(sp.from) ?? ""}
          to={firstQueryValue(sp.to) ?? ""}
        />
      </div>

      <form method="get" action={EVENTS_PATH} className="filter-form filter-form--row">
        {appFilter ? <input type="hidden" name="app" value={appFilter} /> : null}
        {firstQueryValue(sp.range) ? (
          <input type="hidden" name="range" value={firstQueryValue(sp.range) ?? ""} />
        ) : null}
        {firstQueryValue(sp.from) ? (
          <input type="hidden" name="from" value={firstQueryValue(sp.from) ?? ""} />
        ) : null}
        {firstQueryValue(sp.to) ? (
          <input type="hidden" name="to" value={firstQueryValue(sp.to) ?? ""} />
        ) : null}
        {pageSize !== DEFAULT_LIST_PAGE_SIZE ? (
          <input type="hidden" name="pageSize" value={String(pageSize)} />
        ) : null}
        <label className="filter-label" htmlFor="ev-name">
          Event name
        </label>
        <input
          id="ev-name"
          name="name"
          className="filter-input"
          defaultValue={firstQueryValue(sp.name) ?? ""}
          placeholder="e.g. screen_view"
        />
        <label className="filter-label" htmlFor="ev-env">
          Environment
        </label>
        <select
          id="ev-env"
          name="environment"
          className="filter-input"
          defaultValue={firstQueryValue(sp.environment) ?? ""}
        >
          <option value="">Any</option>
          {opts.environments.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <label className="filter-label" htmlFor="ev-plat">
          Platform
        </label>
        <select
          id="ev-plat"
          name="platform"
          className="filter-input"
          defaultValue={firstQueryValue(sp.platform) ?? ""}
        >
          <option value="">Any</option>
          {opts.platforms.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <label className="filter-label" htmlFor="ev-rel">
          Release
        </label>
        <select
          id="ev-rel"
          name="release"
          className="filter-input"
          defaultValue={firstQueryValue(sp.release) ?? ""}
        >
          <option value="">Any</option>
          {opts.releases.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <label className="filter-label" htmlFor="ev-props">
          Properties (contains)
        </label>
        <input
          id="ev-props"
          name="propertiesContains"
          className="filter-input"
          defaultValue={firstQueryValue(sp.propertiesContains) ?? ""}
          placeholder="JSON substring…"
        />
        <button type="submit" className="filter-btn">
          Apply filters
        </button>
      </form>

      <p className="filter-hint text-muted-foreground text-sm">
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
                <th>Created</th>
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
                  <td className="table-cell-properties">
                    {e.properties != null &&
                    typeof e.properties === "object" &&
                    Object.keys(e.properties as object).length > 0 ? (
                      <pre className="table-properties-json">
                        {JSON.stringify(e.properties, null, 2)}
                      </pre>
                    ) : (
                      <span className="table-properties-empty">—</span>
                    )}
                  </td>
                  <td>{new Date(e.created_at).toLocaleString()}</td>
                  <td className="table-cell-view">
                    <Link
                      href={
                        appFilter
                          ? `/dashboard/events/${e.id}?app=${encodeURIComponent(appFilter)}`
                          : `/dashboard/events/${e.id}`
                      }
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      ) : (
        <EmptyState
          message={
            appFilter || firstQueryValue(sp.name)
              ? "No events for this filter."
              : "No events yet."
          }
        />
      )}
      <Pagination total={total} page={page} pageSize={pageSize} hrefForPage={hrefForPage} />
    </>
  );
}
