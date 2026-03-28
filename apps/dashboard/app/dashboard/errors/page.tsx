const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "@/app/components/PageTitle";
import { Badge } from "@/app/components/Badge";
import { ErrorsListToolbar } from "@/app/components/dashboard/ErrorsListToolbar";
import { effectiveListRange } from "@/app/components/dashboard/DateRangeShortcuts";
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
  users_affected?: number;
  sessions_affected?: number;
  occurrences_recent?: number;
  occurrences_previous?: number;
  trend_ratio?: number;
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
  sort?: string | string[];
  order?: string | string[];
  trendWindow?: string | string[];
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
    "sort",
    "order",
    "trendWindow",
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
    sort?: string | string[];
    order?: string | string[];
    trendWindow?: string | string[];
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
  const sort = firstQueryValue(sp.sort);
  const order = firstQueryValue(sp.order);
  const trendWindow = firstQueryValue(sp.trendWindow);
  if (r) apiQuery.set("range", r);
  if (from) apiQuery.set("from", from);
  if (to) apiQuery.set("to", to);
  if (env) apiQuery.set("environment", env);
  if (q) apiQuery.set("q", q);
  if (status) apiQuery.set("status", status);
  if (sort) apiQuery.set("sort", sort);
  if (order) apiQuery.set("order", order);
  if (trendWindow) apiQuery.set("trendWindow", trendWindow);

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

  const context = appFilter ? `App: ${appFilter}` : "All apps";

  return (
    <>
      <PageTitle title="Errors" context={context} />

      <ErrorsListToolbar
        path={ERRORS_PATH}
        currentParams={currentParams}
        activePreset={rangeEff.activePreset}
        customRange={rangeEff.customRange}
        rangePreset={r ?? ""}
        appFilter={appFilter}
        pageSize={String(pageSize)}
        defaultPageSize={DEFAULT_LIST_PAGE_SIZE}
        from={from ?? ""}
        to={to ?? ""}
        q={q ?? ""}
        environment={env ?? ""}
        status={status ?? "all"}
        sort={sort ?? "last_seen"}
        order={order ?? "desc"}
        trendWindow={trendWindow ?? "24h"}
        environments={filterOptions.environments}
      />

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
                {g.users_affected != null && g.users_affected > 0 ? (
                  <>
                    {" "}
                    · Users: {g.users_affected}
                  </>
                ) : null}
                {g.sessions_affected != null && g.sessions_affected > 0 ? (
                  <>
                    {" "}
                    · Sessions: {g.sessions_affected}
                  </>
                ) : null}
                {(g.occurrences_recent ?? 0) + (g.occurrences_previous ?? 0) >
                0 ? (
                  <>
                    {" "}
                    · Trend: {g.occurrences_recent ?? 0} recent /{" "}
                    {g.occurrences_previous ?? 0} prior
                    {g.trend_ratio != null ? (
                      <>
                        {" "}
                        (×{g.trend_ratio.toFixed(2)})
                      </>
                    ) : null}
                  </>
                ) : null}
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
