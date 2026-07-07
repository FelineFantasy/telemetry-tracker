"use client";

import { useId, useMemo } from "react";
import { DashboardCustomSelect } from "@/app/components/dashboard/DashboardCustomSelect";
import type { DashboardSelectOption } from "@/app/components/dashboard/DashboardCustomSelect";
import { FiltersSortPanel } from "@/app/components/dashboard/FiltersSortPanel";
import {
  FilterField,
  FilterForm,
  FilterInput,
  FilterLabel,
  FilterRow,
  FilterSegment,
  FilterSegmentItem,
  FilterSubmitBtn,
  FilterSubmitWrap,
} from "@/app/components/dashboard/list-filters-ui";
import {
  ListFiltersTimeRangeSection,
  listFiltersRangeSummary,
} from "@/app/components/dashboard/ListFiltersTimeRangeSection";
import { TimeRangePicker } from "@/app/components/dashboard/TimeRangePicker";
import {
  listTimeRangeHiddenFields,
  trendTimeRangeHiddenFields,
  TREND_TIME_RANGE_QUERY_KEYS,
  type ParsedTimeRange,
} from "@/lib/time-range";

type Props = {
  path: string;
  currentParams: Record<string, string>;
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
  release: string;
  status: string;
  sort: string;
  order: string;
  environments: string[];
  releases: string[];
};

export function ErrorsListToolbar({
  path,
  currentParams,
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
  release,
  status,
  sort,
  order,
  environments,
  releases,
}: Props) {
  const fieldIds = useId();

  const rangeSummary = listFiltersRangeSummary(timeRange.key, timeRange.label);
  const timeHidden = listTimeRangeHiddenFields(timeRange, fromParam, toParam);
  const trendHidden = trendTimeRangeHiddenFields(
    trendTimeRange,
    trendFromParam,
    trendToParam
  );
  const pickerRange = {
    key: timeRange.key,
    label: timeRange.label,
    shortLabel: timeRange.shortLabel,
    gte: fromParam || timeRange.gte.toISOString(),
    lte: toParam || timeRange.lte.toISOString(),
  };
  const trendPickerRange = {
    key: trendTimeRange.key,
    label: trendTimeRange.label,
    shortLabel: trendTimeRange.shortLabel,
    gte: trendFromParam || trendTimeRange.gte.toISOString(),
    lte: trendToParam || trendTimeRange.lte.toISOString(),
  };

  const sortOptions: DashboardSelectOption[] = useMemo(
    () => [
      { value: "last_seen", label: "Last seen" },
      { value: "first_seen", label: "First seen" },
      { value: "occurrences", label: "Occurrences" },
      { value: "message", label: "Message" },
      { value: "app", label: "App" },
      { value: "environment", label: "Environment" },
      { value: "users", label: "Users affected" },
      { value: "sessions", label: "Sessions" },
      { value: "trend", label: "Trend" },
    ],
    []
  );

  const environmentOptions: DashboardSelectOption[] = useMemo(
    () => [
      { value: "", label: "Any" },
      ...environments.map((e) => ({ value: e, label: e })),
    ],
    [environments]
  );

  const releaseOptions: DashboardSelectOption[] = useMemo(
    () => [
      { value: "", label: "Any" },
      ...releases.map((e) => ({ value: e, label: e })),
    ],
    [releases]
  );

  const statusOptions: DashboardSelectOption[] = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "unresolved", label: "Open" },
      { value: "resolved", label: "Resolved" },
    ],
    []
  );

  const id = (suffix: string) => `${fieldIds.replace(/:/g, "")}-${suffix}`;

  return (
    <FiltersSortPanel rangeSummary={rangeSummary}>
      <ListFiltersTimeRangeSection
        path={path}
        currentParams={currentParams}
        parsedRange={pickerRange}
        includeAll
      />

      <FilterForm method="get" action={path}>
        {appFilter ? <input type="hidden" name="app" value={appFilter} /> : null}
        {Object.entries(timeHidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {Object.entries(trendHidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {Number(pageSize) !== defaultPageSize ? (
          <input type="hidden" name="pageSize" value={pageSize} />
        ) : null}

        <FilterRow>
          <FilterField grow>
            <FilterLabel>Search message</FilterLabel>
            <FilterInput
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Filter by error text…"
              autoComplete="off"
            />
          </FilterField>
          <FilterField>
            <FilterLabel id={id("env-l")}>Environment</FilterLabel>
            <DashboardCustomSelect
              name="environment"
              value={environment}
              options={environmentOptions}
              triggerId={id("env-t")}
              listLabelledBy={id("env-l")}
            />
          </FilterField>
          <FilterField>
            <FilterLabel id={id("status-l")}>Status</FilterLabel>
            <DashboardCustomSelect
              name="status"
              value={status || "all"}
              options={statusOptions}
              triggerId={id("status-t")}
              listLabelledBy={id("status-l")}
            />
          </FilterField>
          <FilterField>
            <FilterLabel id={id("release-l")}>Release</FilterLabel>
            <DashboardCustomSelect
              name="release"
              value={release}
              options={releaseOptions}
              triggerId={id("release-t")}
              listLabelledBy={id("release-l")}
            />
          </FilterField>
        </FilterRow>

        <FilterRow>
          <FilterField>
            <FilterLabel id={id("sort-l")}>Sort by</FilterLabel>
            <DashboardCustomSelect
              name="sort"
              value={sort || "last_seen"}
              options={sortOptions}
              triggerId={id("sort-t")}
              listLabelledBy={id("sort-l")}
            />
          </FilterField>

          <FilterSegment
            legend="Order"
            title="Descending: newest dates and largest counts first. Ascending: the opposite."
            ariaLabel="Sort order"
          >
            <FilterSegmentItem name="order" value="desc" defaultChecked={order !== "asc"}>
              Desc
            </FilterSegmentItem>
            <FilterSegmentItem name="order" value="asc" defaultChecked={order === "asc"}>
              Asc
            </FilterSegmentItem>
          </FilterSegment>

          <FilterField>
            <FilterLabel>Trend window</FilterLabel>
            <p className="mb-1 text-[11px] text-muted-foreground">
              Compares recent vs prior period of equal length
            </p>
            <TimeRangePicker
              path={path}
              currentParams={currentParams}
              range={trendPickerRange}
              queryKeys={TREND_TIME_RANGE_QUERY_KEYS}
              compact
            />
          </FilterField>

          <FilterSubmitWrap>
            <FilterSubmitBtn>Apply</FilterSubmitBtn>
          </FilterSubmitWrap>
        </FilterRow>
      </FilterForm>
    </FiltersSortPanel>
  );
}
