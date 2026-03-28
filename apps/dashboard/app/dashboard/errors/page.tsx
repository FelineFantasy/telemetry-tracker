const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "@/app/components/PageTitle";
import { Badge } from "@/app/components/Badge";
import { CustomDateRangeForm } from "@/app/components/dashboard/CustomDateRangeForm";
import { DateRangeShortcuts, effectiveListRange } from "@/app/components/dashboard/DateRangeShortcuts";
import { ListResultCount } from "@/app/components/dashboard/ListResultCount";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { Pagination } from "@/app/components/ui/Pagination";
import { mergeListQuery } from "@/lib/list-filters-url";
import {
  DEFAULT_LIST_PAGE_SIZE,
  parsePageParam,
  parsePageSizeParam,
  resolveApiListTotal,
} from "@/lib/pagination";
import { firstQueryValue } from "@/lib/search-params";
import Link from "next/link";

const ERRORS_PATH = "/dashboard/errors";

type ErrorGroupRow = {
  id: string;
  message: string;
  app: string;
  top_stack?: string;
  occurrences: number;
  first_seen: string;
  last_seen: string;
  resolved_at?: string | null;
  environment?: string | null;
};

async function getErrors(
  search: URLSearchParams
): Promise<{
  items: ErrorGroupRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const res = await fetch(`${API_BASE}/api/errors?${search.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function getFilterOptions(app?: string) {
  const p = new URLSearchParams();
  if (app) p.set("app", app);
  const res = await fetch(`${API_BASE}/api/filter-options?${p.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return { environments: [] as string[], platforms: [], releases: [] };
  const data = (await res.json()) as { environments?: string[] };
  return { environments: data.environments ?? [] };
}

function buildErrorsParamsRecord(sp: {
  app?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
  limit?: string | string[];
  range?: string | string[];
  from?: string | string[];
  to?: string | string[];
  environment?: string | string[];
  q?: string | string[];
  status?: string | string[];
}): Record<string, string> {
  const keys = [
    "app",
    "page",
    "pageSize",
    "limit",
    "range",
    "from",
    "to",
    "environment",
    "q",
    "status",
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
    q?: string | string[];
    status?: string | string[];
  }>;
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
  const env = firstQueryValue(sp.environment);
  const q = firstQueryValue(sp.q);
  const status = firstQueryValue(sp.status);
  if (r) apiQuery.set("range", r);
  if (from) apiQuery.set("from", from);
  if (to) apiQuery.set("to", to);
  if (env) apiQuery.set("environment", env);
  if (q) apiQuery.set("q", q);
  if (status) apiQuery.set("status", status);

  let items: ErrorGroupRow[] = [];
  let total = 0;
  let filterOptions = { environments: [] as string[] };
  try {
    const [data, opts] = await Promise.all([
      getErrors(apiQuery),
      getFilterOptions(appFilter || undefined),
    ]);
    items = data.items ?? [];
    total = resolveApiListTotal(data.total, items.length);
    filterOptions = opts;
  } catch (e) {
    return (
      <>
        <PageTitle title="Errors" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const currentParams = buildErrorsParamsRecord(sp);
  const hrefForPage = (p: number) =>
    mergeListQuery(ERRORS_PATH, currentParams, { page: String(p) });

  const hiddenForCustomDates: Record<string, string> = { ...currentParams };
  delete hiddenForCustomDates.from;
  delete hiddenForCustomDates.to;
  delete hiddenForCustomDates.page;
  delete hiddenForCustomDates.range;

  const context = appFilter ? `App: ${appFilter}` : "All apps";

  return (
    <>
      <PageTitle title="Errors" context={context} />

      <div className="filter-toolbar">
        <DateRangeShortcuts
          path={ERRORS_PATH}
          currentParams={currentParams}
          activePreset={rangeEff.activePreset}
          customRange={rangeEff.customRange}
        />
        <CustomDateRangeForm
          path={ERRORS_PATH}
          hiddenParams={hiddenForCustomDates}
          from={firstQueryValue(sp.from) ?? ""}
          to={firstQueryValue(sp.to) ?? ""}
        />
      </div>

      <form method="get" action={ERRORS_PATH} className="filter-form filter-form--row">
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
        <label className="filter-label" htmlFor="err-q">
          Message contains
        </label>
        <input
          id="err-q"
          name="q"
          className="filter-input"
          defaultValue={firstQueryValue(sp.q) ?? ""}
          placeholder="Search message…"
        />
        <label className="filter-label" htmlFor="err-env">
          Environment
        </label>
        <select
          id="err-env"
          name="environment"
          className="filter-input"
          defaultValue={firstQueryValue(sp.environment) ?? ""}
        >
          <option value="">Any</option>
          {filterOptions.environments.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <label className="filter-label" htmlFor="err-status">
          Status
        </label>
        <select
          id="err-status"
          name="status"
          className="filter-input"
          defaultValue={firstQueryValue(sp.status) ?? "all"}
        >
          <option value="all">All</option>
          <option value="unresolved">Open</option>
          <option value="resolved">Resolved</option>
        </select>
        <button type="submit" className="filter-btn">
          Apply filters
        </button>
      </form>

      <ListResultCount total={total} noun={total === 1 ? "error group" : "error groups"} />

      {items.length ? (
        <ul className="unstyled-list cards-list">
          {items.map((g) => (
            <li key={g.id} className="card">
              <Badge>{g.app}</Badge>
              {g.environment ? (
                <>
                  {" "}
                  <Badge>{g.environment}</Badge>
                </>
              ) : null}
              {g.resolved_at ? (
                <>
                  {" "}
                  <span className="badge badge--resolved">Resolved</span>
                </>
              ) : null}{" "}
              <Link
                href={
                  appFilter
                    ? `/dashboard/errors/${g.id}?app=${encodeURIComponent(appFilter)}`
                    : `/dashboard/errors/${g.id}`
                }
                className="list-link !text-danger"
              >
                {g.message}
              </Link>
              {g.top_stack && (
                <pre className="occurrence-card__meta">{g.top_stack}</pre>
              )}
              <span className="card__label card__label--block">
                {g.occurrences} occurrences · first{" "}
                {new Date(g.first_seen).toLocaleString()} · last{" "}
                {new Date(g.last_seen).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          message={
            appFilter
              ? `No errors for "${appFilter}" with these filters.`
              : "No error groups match these filters."
          }
        />
      )}
      <Pagination total={total} page={page} pageSize={pageSize} hrefForPage={hrefForPage} />
    </>
  );
}
