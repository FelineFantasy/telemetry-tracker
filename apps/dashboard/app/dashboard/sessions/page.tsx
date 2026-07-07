import { PageTitle } from "@/app/components/PageTitle";
import { SessionsListToolbar } from "@/app/components/dashboard/SessionsListToolbar";
import { mergeListQuery } from "@/lib/list-filters-url";
import { appendListTimeRangeToParams, parseListTimeRangeOrDefault } from "@/lib/time-range";
import { ListResultCount } from "@/app/components/dashboard/ListResultCount";
import { AnalyticsListShell } from "@/app/components/dashboard/analytics-ui";
import { EmptyState } from "@/app/components/EmptyState";
import { TimeAgo } from "@/app/components/TimeAgo";
import { ErrorState } from "@/app/components/ErrorState";
import { Pagination } from "@/app/components/ui/Pagination";
import { Table, TableListLink, TableViewLink, TableWrap, tableDateColumnClass } from "@/app/components/ui/Table";
import {
  DEFAULT_LIST_PAGE_SIZE,
  parsePageParam,
  parsePageSizeParam,
  resolveApiListTotal,
} from "@/lib/pagination";
import { firstQueryValue } from "@/lib/search-params";
import { dashboardApiFetch } from "@/lib/dashboard-api";

const SESSIONS_PATH = "/dashboard/sessions";

type SessionRow = {
  id: string;
  session_id: string;
  user_id?: string | null;
  anonymous_id?: string | null;
  started_at: string;
  ended_at?: string | null;
};

function truncate(s: string, len: number) {
  return s.length <= len ? s : s.slice(0, len) + "\u2026";
}

async function getSessions(search: URLSearchParams) {
  const res = await dashboardApiFetch(`/api/sessions?${search.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<{
    items: SessionRow[];
    total: number;
    page: number;
    pageSize: number;
  }>;
}

async function getFilterOptions(app?: string) {
  const p = new URLSearchParams();
  if (app) p.set("app", app);
  const res = await dashboardApiFetch(`/api/filter-options?${p.toString()}`);
  if (!res.ok) return { platforms: [] as string[] };
  const data = (await res.json()) as { platforms?: string[] };
  return { platforms: data.platforms ?? [] };
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
    "platform",
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

export default async function SessionsPage({
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
  const sort = firstQueryValue(sp.sort);
  const order = firstQueryValue(sp.order);
  if (platform) apiQuery.set("platform", platform);
  if (sort) apiQuery.set("sort", sort);
  if (order) apiQuery.set("order", order);

  let items: SessionRow[] = [];
  let total = 0;
  let platforms: string[] = [];
  try {
    const [data, opts] = await Promise.all([
      getSessions(apiQuery),
      getFilterOptions(appFilter || undefined),
    ]);
    items = data.items ?? [];
    total = resolveApiListTotal(data.total, items.length);
    platforms = opts.platforms;
  } catch (e) {
    return (
      <>
        <PageTitle title="Sessions" />
        <ErrorState message={String(e instanceof Error ? e.message : e)} />
      </>
    );
  }

  const currentParams = buildSessionsParamsRecord(sp);
  const hrefForPage = (p: number) =>
    mergeListQuery(SESSIONS_PATH, currentParams, { page: String(p) });

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
        <SessionsListToolbar
        path={SESSIONS_PATH}
        currentParams={currentParams}
        timeRange={timeRange}
        fromParam={from}
        toParam={to}
        appFilter={appFilter}
        pageSize={String(pageSize)}
        defaultPageSize={DEFAULT_LIST_PAGE_SIZE}
        platform={platform ?? ""}
        sort={sort ?? "started_at"}
        order={order ?? "desc"}
        platforms={platforms}
        />

        <ListResultCount total={total} noun={total === 1 ? "session" : "sessions"} />

        {items.length ? (
          <TableWrap>
          <Table>
            <thead>
              <tr>
                <th>Session ID</th>
                <th className="hidden sm:table-cell">Identity</th>
                <th className={tableDateColumnClass}>Started</th>
                <th className={`hidden sm:table-cell ${tableDateColumnClass}`}>Ended</th>
                <th className="hidden sm:table-cell" aria-hidden>
                  View
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td title={s.session_id}>
                    <TableListLink
                      href={
                        appFilter
                          ? `/dashboard/sessions/${s.id}?app=${encodeURIComponent(appFilter)}`
                          : `/dashboard/sessions/${s.id}`
                      }
                    >
                      {truncate(s.session_id, 24)}
                    </TableListLink>
                  </td>
                  <td title={s.user_id ?? s.anonymous_id ?? undefined} className="hidden sm:table-cell">
                    {(s.user_id ?? s.anonymous_id)
                      ? truncate(s.user_id ?? s.anonymous_id ?? "", 20)
                      : "—"}
                  </td>
                  <td className={tableDateColumnClass}>
                    <TimeAgo iso={s.started_at} />
                  </td>
                  <td className={`hidden sm:table-cell ${tableDateColumnClass}`}>
                    {s.ended_at ? <TimeAgo iso={s.ended_at} /> : "—"}
                  </td>
                  <td className="hidden sm:table-cell">
                    <TableViewLink
                      href={
                        appFilter
                          ? `/dashboard/sessions/${s.id}?app=${encodeURIComponent(appFilter)}`
                          : `/dashboard/sessions/${s.id}`
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
