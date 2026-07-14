"use client";

import { useCallback } from "react";
import { EventsListToolbar } from "@/app/components/dashboard/EventsListToolbar";
import { EventsTable, type EventsTableRow } from "@/app/components/dashboard/EventsTable";
import { AnalyticsListTableFrame } from "@/app/components/dashboard/AnalyticsListTableFrame";
import { ListResultCount } from "@/app/components/dashboard/ListResultCount";
import { EmptyState } from "@/app/components/EmptyState";
import { ErrorState } from "@/app/components/ErrorState";
import { Pagination } from "@/app/components/ui/Pagination";
import { mergeListQuery } from "@/lib/list-filters-url";
import type { ParsedTimeRange } from "@/lib/time-range";
import { resolveApiListTotal } from "@/lib/pagination";
import { useAnalyticsList } from "@/lib/use-analytics-list";

type EventsListResponse = {
  items: EventsTableRow[];
  total: number;
  page: number;
  pageSize: number;
};

type Props = {
  path: string;
  urlParams: Record<string, string>;
  initialListParams: Record<string, string>;
  initialData: EventsListResponse;
  timeRange: ParsedTimeRange;
  fromParam: string;
  toParam: string;
  appFilter: string;
  pageSize: string;
  defaultPageSize: number;
  name: string;
  environment: string;
  platform: string;
  release: string;
  propertiesContains: string;
  sort: string;
  order: string;
  environments: string[];
  platforms: string[];
  releases: string[];
};

export function EventsClientListSection({
  path,
  urlParams,
  initialListParams,
  initialData,
  timeRange,
  fromParam,
  toParam,
  appFilter,
  pageSize,
  defaultPageSize,
  name,
  environment,
  platform,
  release,
  propertiesContains,
  sort,
  order,
  environments,
  platforms,
  releases,
}: Props) {
  const { data, error, isValidating, listParams, liveUrlParams, patchListQuery } =
    useAnalyticsList<EventsListResponse>({
      cacheKey: "events-list",
      apiPath: "/api/events",
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
      <EventsListToolbar
        path={path}
        currentParams={liveUrlParams}
        timeRange={timeRange}
        fromParam={fromParam}
        toParam={toParam}
        appFilter={appFilter}
        pageSize={String(pageSizeNum)}
        defaultPageSize={defaultPageSize}
        name={name}
        environment={environment}
        platform={platform}
        release={release}
        propertiesContains={propertiesContains}
        sort={effectiveSort}
        order={effectiveOrder}
        environments={environments}
        platforms={platforms}
        releases={releases}
        onSortApply={onSortApply}
        sortLoading={isValidating}
      />

      <p className="text-sm text-muted-foreground">
        Properties search matches raw JSON text (useful for known keys or values).
      </p>

      <ListResultCount
        total={total}
        noun={total === 1 ? "event name" : "event names"}
      />

      <AnalyticsListTableFrame isLoading={isValidating}>
        {error ? (
          <ErrorState message={error instanceof Error ? error.message : String(error)} />
        ) : items.length ? (
          <EventsTable
            rows={items}
            hrefForName={(row) =>
              mergeListQuery(path, { ...urlParams, ...listParams }, { name: row.name, page: "1" })
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
