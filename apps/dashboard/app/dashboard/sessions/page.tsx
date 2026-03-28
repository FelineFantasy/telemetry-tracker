const API_BASE = process.env.API_URL || "http://localhost:3001";

import { PageTitle } from "@/app/components/PageTitle";
import { FilterFormSelect } from "@/app/components/dashboard/FilterFormSelect";
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
  const res = await fetch(`${API_BASE}/api/sessions?${search.toString()}`, {
    cache: "no-store",
  });
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
  const res = await fetch(`${API_BASE}/api/filter-options?${p.toString()}`, {
    cache: "no-store",
  });
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
  const rangeEff = effectiveListRange(
    {
      range: firstQueryValue(sp.range),
      from: firstQueryValue(sp.from),
      to: firstQueryValue(sp.to),
    },
    "24h"
  );

  const apiQuery = new URLSearchParams();
  if (appFilter) apiQuery.set("app", appFilter);
  apiQuery.set("page", String(page));
  apiQuery.set("pageSize", String(pageSize));
  const r = firstQueryValue(sp.range);
  const from = firstQueryValue(sp.from);
  const to = firstQueryValue(sp.to);
  const platform = firstQueryValue(sp.platform);
  if (r) apiQuery.set("range", r);
  if (from) apiQuery.set("from", from);
  if (to) apiQuery.set("to", to);
  if (platform) apiQuery.set("platform", platform);

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

  const hiddenForCustomDates: Record<string, string> = { ...currentParams };
  delete hiddenForCustomDates.from;
  delete hiddenForCustomDates.to;
  delete hiddenForCustomDates.page;
  delete hiddenForCustomDates.range;

  const rangeLabel =
    rangeEff.customRange || firstQueryValue(sp.from) || firstQueryValue(sp.to)
      ? "Custom range"
      : firstQueryValue(sp.range) === "all"
        ? "All time"
        : firstQueryValue(sp.range) === "7d"
          ? "Last 7 days"
          : firstQueryValue(sp.range) === "30d"
            ? "Last 30 days"
            : firstQueryValue(sp.range) === "90d"
              ? "Last 90 days"
              : "Last 24 hours";

  const context = appFilter ? `${rangeLabel} · App: ${appFilter}` : rangeLabel;

  return (
    <>
      <PageTitle title="Sessions" context={context} />

      <div className="filter-toolbar">
        <DateRangeShortcuts
          path={SESSIONS_PATH}
          currentParams={currentParams}
          activePreset={rangeEff.activePreset}
          customRange={rangeEff.customRange}
        />
        <CustomDateRangeForm
          path={SESSIONS_PATH}
          hiddenParams={hiddenForCustomDates}
          from={firstQueryValue(sp.from) ?? ""}
          to={firstQueryValue(sp.to) ?? ""}
        />
      </div>

      <form method="get" action={SESSIONS_PATH} className="filter-form filter-form--row">
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
        <FilterFormSelect
          name="platform"
          value={firstQueryValue(sp.platform) ?? ""}
          items={platforms}
          label="Platform"
        />
        <button type="submit" className="filter-btn">
          Apply filters
        </button>
      </form>

      <ListResultCount total={total} noun={total === 1 ? "session" : "sessions"} />

      {items.length ? (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Identity</th>
                <th>Started</th>
                <th>Ended</th>
                <th aria-hidden>View</th>
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
                  <td title={s.user_id ?? s.anonymous_id ?? undefined}>
                    {(s.user_id ?? s.anonymous_id)
                      ? truncate(s.user_id ?? s.anonymous_id ?? "", 20)
                      : "—"}
                  </td>
                  <td>{new Date(s.started_at).toLocaleString()}</td>
                  <td>
                    {s.ended_at ? new Date(s.ended_at).toLocaleString() : "—"}
                  </td>
                  <td className="table-cell-view">
                    <Link
                      href={
                        appFilter
                          ? `/dashboard/sessions/${s.id}?app=${encodeURIComponent(appFilter)}`
                          : `/dashboard/sessions/${s.id}`
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
            appFilter
              ? `No sessions for these filters (app "${appFilter}").`
              : `No sessions for these filters (${rangeLabel}).`
          }
        />
      )}
      <Pagination total={total} page={page} pageSize={pageSize} hrefForPage={hrefForPage} />
    </>
  );
}
