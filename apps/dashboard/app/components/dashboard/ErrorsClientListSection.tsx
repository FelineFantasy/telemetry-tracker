"use client";

import { useCallback } from "react";
import { ErrorsListToolbar } from "@/app/components/dashboard/ErrorsListToolbar";
import { IssuesTable } from "@/app/components/dashboard/IssueList";
import { AnalyticsListTableFrame } from "@/app/components/dashboard/AnalyticsListTableFrame";
import { ListResultCount } from "@/app/components/dashboard/ListResultCount";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { Pagination } from "@/app/components/ui/Pagination";
import { mergeListQuery } from "@/lib/list-filters-url";
import { buildErrorGroupDetailHref } from "@/lib/overview-scope-url";
import type { ParsedTimeRange } from "@/lib/time-range";
import { resolveApiListTotal } from "@/lib/pagination";
import { useAnalyticsList } from "@/lib/use-analytics-list";

type ErrorGroupRow = {
  id: string;
  message: string;
  app: string;
  top_stack?: string;
  occurrences: number;
  occurrences_in_range?: number;
  first_seen: string;
  last_seen: string;
  resolved_at?: string | null;
  environment?: string | null;
  users_affected?: number;
  sessions_affected?: number;
  occurrences_recent?: number;
  occurrences_previous?: number;
  trend_ratio?: number;
  error_type?: string;
  sparkline?: { t: string; count: number }[];
};

type ErrorsListResponse = {
  items: ErrorGroupRow[];
  total: number;
  page: number;
  pageSize: number;
};

type Props = {
  path: string;
  urlParams: Record<string, string>;
  initialListParams: Record<string, string>;
  initialData: ErrorsListResponse;
  timeRange: ParsedTimeRange;
  fromParam: string;
  toParam: string;
  trendTimeRange: ParsedTimeRange;
  trendFromParam: string;
  trendToParam: string;
  appFilter: string;
  pageSize: string;
  defaultPageSize: number;
  q: string;
  environment: string;
  platform: string;
  release: string;
  status: string;
  sort: string;
  order: string;
  environments: string[];
  platforms: string[];
  releases: string[];
};

export function ErrorsClientListSection({
  path,
  urlParams,
  initialListParams,
  initialData,
  timeRange,
  fromParam,
  toParam,
  trendTimeRange,
  trendFromParam,
  trendToParam,
  appFilter,
  pageSize,
  defaultPageSize,
  q,
  environment,
  platform,
  release,
  status,
  sort,
  order,
  environments,
  platforms,
  releases,
}: Props) {
  const { data, error, isValidating, listParams, liveUrlParams, patchListQuery } =
    useAnalyticsList<ErrorsListResponse>({
      cacheKey: "errors-list",
      apiPath: "/api/errors",
      path,
      initialData,
      initialListParams,
      urlParams,
    });

  const items = data.items ?? [];
  const total = resolveApiListTotal(data.total, items.length);
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
    (p: number) => mergeListQuery(path, liveUrlParams, { page: String(p) }),
    [path, liveUrlParams]
  );

  const onPageChange = useCallback(
    (p: number) => {
      patchListQuery({ page: String(p) });
    },
    [patchListQuery]
  );

  return (
    <>
      <ErrorsListToolbar
        path={path}
        currentParams={liveUrlParams}
        timeRange={timeRange}
        fromParam={fromParam}
        toParam={toParam}
        trendTimeRange={trendTimeRange}
        trendFromParam={trendFromParam}
        trendToParam={trendToParam}
        appFilter={appFilter}
        pageSize={String(pageSizeNum)}
        defaultPageSize={defaultPageSize}
        q={q}
        environment={environment}
        platform={platform}
        release={release}
        status={status}
        sort={effectiveSort}
        order={effectiveOrder}
        environments={environments}
        platforms={platforms}
        releases={releases}
        onSortApply={onSortApply}
        sortLoading={isValidating}
      />

      <ListResultCount total={total} noun={total === 1 ? "error group" : "error groups"} />

      <AnalyticsListTableFrame
        isLoading={isValidating}
        refreshError={error && items.length ? error : undefined}
      >
        {items.length ? (
          <IssuesTable
            rows={items}
            hrefForRow={(g) =>
              buildErrorGroupDetailHref(g.id, {
                app: appFilter || null,
                environment: environment || null,
                platform: platform || null,
                release: release || null,
                range: urlParams.range || null,
                from: urlParams.from || null,
                to: urlParams.to || null,
                // Align detail with Issues list metrics window for unbounded ranges.
                metricsUntil:
                  listParams.metricsUntil || new Date().toISOString(),
              })
            }
          />
        ) : error ? (
          <ErrorState message={error instanceof Error ? error.message : String(error)} />
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
