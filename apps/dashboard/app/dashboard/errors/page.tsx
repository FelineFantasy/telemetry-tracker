import { PageTitle } from "@/app/components/PageTitle";
import { redirect } from "next/navigation";
import { ErrorsListToolbar } from "@/app/components/dashboard/ErrorsListToolbar";
import { effectiveListRange } from "@/lib/list-filters-url";
import { ListResultCount } from "@/app/components/dashboard/ListResultCount";
import { IssueList, IssueListItem } from "@/app/components/dashboard/IssueList";
import { EmptyState } from "@/app/components/EmptyState";
import { TimeAgo } from "@/app/components/TimeAgo";
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
import { resolveScopedQueryValue } from "@/lib/overview-scope-url";
import { dashboardApiFetch } from "@/lib/dashboard-api";

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
  const res = await dashboardApiFetch(`/api/errors?${search.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function getFilterOptions(app?: string) {
  const p = new URLSearchParams();
  if (app) p.set("app", app);
  const res = await dashboardApiFetch(`/api/filter-options?${p.toString()}`);
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
  const currentParams = buildErrorsParamsRecord(sp);
  const appFilter = firstQueryValue(sp.app) ?? "";
  const rawEnv = firstQueryValue(sp.environment)?.trim() || null;
  const filterOptions = await getFilterOptions(appFilter || undefined);
  const environment = resolveScopedQueryValue(rawEnv, filterOptions.environments);
  if (rawEnv !== environment) {
    redirect(mergeListQuery(ERRORS_PATH, currentParams, { environment }));
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
  const q = firstQueryValue(sp.q);
  const status = firstQueryValue(sp.status);
  const sort = firstQueryValue(sp.sort);
  const order = firstQueryValue(sp.order);
  const trendWindow = firstQueryValue(sp.trendWindow);
  if (r) apiQuery.set("range", r);
  if (from) apiQuery.set("from", from);
  if (to) apiQuery.set("to", to);
  if (environment) apiQuery.set("environment", environment);
  if (q) apiQuery.set("q", q);
  if (status) apiQuery.set("status", status);
  if (sort) apiQuery.set("sort", sort);
  if (order) apiQuery.set("order", order);
  if (trendWindow) apiQuery.set("trendWindow", trendWindow);

  let items: ErrorGroupRow[] = [];
  let total = 0;
  try {
    const data = await getErrors(apiQuery);
    items = data.items ?? [];
    total = resolveApiListTotal(data.total, items.length);
  } catch (e) {
    return (
      <>
        <PageTitle title="Issues" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const hrefForPage = (p: number) =>
    mergeListQuery(ERRORS_PATH, currentParams, { page: String(p) });

  return (
    <>
      <PageTitle
        title="Issues"
        context={
          appFilter
            ? `Grouped errors for app ${appFilter}.`
            : "Grouped errors with status, frequency, and stack traces."
        }
      />

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
        environment={environment ?? ""}
        status={status ?? "all"}
        sort={sort ?? "last_seen"}
        order={order ?? "desc"}
        trendWindow={trendWindow ?? "24h"}
        environments={filterOptions.environments}
      />

      <ListResultCount total={total} noun={total === 1 ? "error group" : "error groups"} />

      {items.length ? (
        <IssueList>
          {items.map((g) => {
            const metaParts = [
              `${g.occurrences} occurrences`,
              <>first <TimeAgo iso={g.first_seen} /></>,
              <>last <TimeAgo iso={g.last_seen} /></>,
            ];
            if (g.users_affected != null && g.users_affected > 0) {
              metaParts.push(`Users: ${g.users_affected}`);
            }
            if (g.sessions_affected != null && g.sessions_affected > 0) {
              metaParts.push(`Sessions: ${g.sessions_affected}`);
            }
            if ((g.occurrences_recent ?? 0) + (g.occurrences_previous ?? 0) > 0) {
              metaParts.push(
                `Trend: ${g.occurrences_recent ?? 0} recent / ${g.occurrences_previous ?? 0} prior${
                  g.trend_ratio != null ? ` (×${g.trend_ratio.toFixed(2)})` : ""
                }`
              );
            }
            return (
              <IssueListItem
                key={g.id}
                href={
                  appFilter
                    ? `/dashboard/errors/${g.id}?app=${encodeURIComponent(appFilter)}`
                    : `/dashboard/errors/${g.id}`
                }
                message={g.message}
                app={g.app}
                environment={g.environment}
                resolved={Boolean(g.resolved_at)}
                topStack={g.top_stack}
                meta={
                  <>
                    {metaParts.map((part, i) => (
                      <span key={i}>
                        {i > 0 ? " · " : null}
                        {part}
                      </span>
                    ))}
                  </>
                }
              />
            );
          })}
        </IssueList>
      ) : (
        <EmptyState
          title="No errors recorded"
          message={
            appFilter
              ? `No error groups for "${appFilter}" with these filters.`
              : "No error groups match these filters. Try another date range or clear filters."
          }
        />
      )}
      <Pagination total={total} page={page} pageSize={pageSize} hrefForPage={hrefForPage} />
    </>
  );
}
