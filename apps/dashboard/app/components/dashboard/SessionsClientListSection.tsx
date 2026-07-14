"use client";

import { useCallback, useMemo } from "react";
import { SessionsListToolbar } from "@/app/components/dashboard/SessionsListToolbar";
import {
  SessionsTable,
  type SessionsTableRow,
} from "@/app/components/dashboard/SessionsTable";
import { AnalyticsListTableFrame } from "@/app/components/dashboard/AnalyticsListTableFrame";
import { ListResultCount } from "@/app/components/dashboard/ListResultCount";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { Pagination } from "@/app/components/ui/Pagination";
import { mergeListQuery } from "@/lib/list-filters-url";
import type { ParsedTimeRange } from "@/lib/time-range";
import { resolveApiListTotal } from "@/lib/pagination";
import { useAnalyticsList } from "@/lib/use-analytics-list";

type SessionsListResponse = {
  items: SessionsTableRow[];
  total: number;
  page: number;
  pageSize: number;
  max_duration_sec?: number;
};

type Props = {
  path: string;
  currentParams: Record<string, string>;
  urlParams: Record<string, string>;
  initialListParams: Record<string, string>;
  initialData: SessionsListResponse;
  timeRange: ParsedTimeRange;
  fromParam: string;
  toParam: string;
  appFilter: string;
  pageSize: string;
  defaultPageSize: number;
  q: string;
  environment: string;
  release: string;
  country: string;
  platform: string;
  sort: string;
  order: string;
  environments: string[];
  releases: string[];
  countries: string[];
  platforms: string[];
  rangeLabel: string;
};

export function SessionsClientListSection({
  path,
  currentParams,
  urlParams,
  initialListParams,
  initialData,
  timeRange,
  fromParam,
  toParam,
  appFilter,
  pageSize,
  defaultPageSize,
  q,
  environment,
  release,
  country,
  platform,
  sort,
  order,
  environments,
  releases,
  countries,
  platforms,
  rangeLabel,
}: Props) {
  const { data, error, isValidating, listParams, patchListQuery } =
    useAnalyticsList<SessionsListResponse>({
      cacheKey: "sessions-list",
      apiPath: "/api/sessions",
      path,
      initialData,
      initialListParams,
      urlParams,
    });

  const items = data.items ?? [];
  const total = resolveApiListTotal(data.total, items.length);
  const maxDurationSec = data.max_duration_sec ?? 0;
  const page = Number(listParams.page ?? "1");
  const pageSizeNum = Number(listParams.pageSize ?? pageSize);
  const effectiveSort = listParams.sort ?? sort;
  const effectiveOrder = listParams.order ?? order;

  const onSortApply = useCallback(
    (nextSort: string, nextOrder: string) => {
      patchListQuery({ sort: nextSort, order: nextOrder, page: "1" });
    },
    [patchListQuery]
  );

  const hrefForPage = useCallback(
    (p: number) => mergeListQuery(path, { ...urlParams, ...listParams }, { page: String(p) }),
    [path, urlParams, listParams]
  );

  const onPageChange = useCallback(
    (p: number) => {
      patchListQuery({ page: String(p) });
    },
    [patchListQuery]
  );

  const listSubtitle = useMemo(() => {
    if (page === 1 && effectiveSort === "duration" && effectiveOrder === "desc") {
      return "Showing top sessions by duration";
    }
    return undefined;
  }, [page, effectiveSort, effectiveOrder]);

  const sessionHref = (row: SessionsTableRow) =>
    appFilter
      ? `/dashboard/sessions/${row.id}?app=${encodeURIComponent(appFilter)}`
      : `/dashboard/sessions/${row.id}`;

  return (
    <>
      <SessionsListToolbar
        path={path}
        currentParams={currentParams}
        timeRange={timeRange}
        fromParam={fromParam}
        toParam={toParam}
        appFilter={appFilter}
        pageSize={String(pageSizeNum)}
        defaultPageSize={defaultPageSize}
        q={q}
        environment={environment}
        release={release}
        country={country}
        platform={platform}
        sort={effectiveSort}
        order={effectiveOrder}
        environments={environments}
        releases={releases}
        countries={countries}
        platforms={platforms}
        onSortApply={onSortApply}
        sortLoading={isValidating}
      />

      <ListResultCount
        total={total}
        noun={total === 1 ? "session" : "sessions"}
        subtitle={listSubtitle}
      />

      <AnalyticsListTableFrame isLoading={isValidating}>
        {error ? (
          <ErrorState message={error instanceof Error ? error.message : String(error)} />
        ) : items.length ? (
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
      </AnalyticsListTableFrame>

      <Pagination
        total={total}
        page={page}
        pageSize={pageSizeNum}
        hrefForPage={hrefForPage}
        onPageChange={onPageChange}
      />
    </>
  );
}
