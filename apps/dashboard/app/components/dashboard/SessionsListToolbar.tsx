"use client";

import { useId, useMemo } from "react";
import { DashboardCustomSelect } from "@/app/components/dashboard/DashboardCustomSelect";
import type { DashboardSelectOption } from "@/app/components/dashboard/DashboardCustomSelect";
import { FiltersSortPanel } from "@/app/components/dashboard/FiltersSortPanel";
import {
  FilterField,
  FilterForm,
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
import { listTimeRangeHiddenFields, type ParsedTimeRange } from "@/lib/time-range";

const SORT_OPTIONS: DashboardSelectOption[] = [
  { value: "started_at", label: "Started" },
  { value: "ended_at", label: "Ended" },
  { value: "session_id", label: "Session ID" },
  { value: "app", label: "App" },
  { value: "platform", label: "Platform" },
  { value: "user_id", label: "User ID" },
];

type Props = {
  path: string;
  currentParams: Record<string, string>;
  timeRange: ParsedTimeRange;
  fromParam: string;
  toParam: string;
  appFilter: string;
  pageSize: string;
  defaultPageSize: number;
  platform: string;
  sort: string;
  order: string;
  platforms: string[];
};

export function SessionsListToolbar({
  path,
  currentParams,
  timeRange,
  fromParam,
  toParam,
  appFilter,
  pageSize,
  defaultPageSize,
  platform,
  sort,
  order,
  platforms,
}: Props) {
  const fieldIds = useId();
  const rangeSummary = listFiltersRangeSummary(timeRange.key, timeRange.label);
  const timeHidden = listTimeRangeHiddenFields(timeRange, fromParam, toParam);
  const pickerRange = {
    key: timeRange.key,
    label: timeRange.label,
    shortLabel: timeRange.shortLabel,
    gte: fromParam || timeRange.gte.toISOString(),
    lte: toParam || timeRange.lte.toISOString(),
  };

  const platformOptions: DashboardSelectOption[] = useMemo(
    () => [
      { value: "", label: "Any" },
      ...platforms.map((e) => ({ value: e, label: e })),
    ],
    [platforms]
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
        {Number(pageSize) !== defaultPageSize ? (
          <input type="hidden" name="pageSize" value={pageSize} />
        ) : null}
        {currentParams.chartBucket ? (
          <input type="hidden" name="chartBucket" value={currentParams.chartBucket} />
        ) : null}

        <FilterRow>
          <FilterField grow>
            <FilterLabel id={id("plat-l")}>Platform</FilterLabel>
            <DashboardCustomSelect
              name="platform"
              value={platform}
              options={platformOptions}
              triggerId={id("plat-t")}
              listLabelledBy={id("plat-l")}
            />
          </FilterField>
        </FilterRow>

        <FilterRow>
          <FilterField>
            <FilterLabel id={id("sort-l")}>Sort by</FilterLabel>
            <DashboardCustomSelect
              name="sort"
              value={sort || "started_at"}
              options={SORT_OPTIONS}
              triggerId={id("sort-t")}
              listLabelledBy={id("sort-l")}
            />
          </FilterField>

          <FilterSegment
            legend="Order"
            title="Descending vs ascending order for the selected column."
            ariaLabel="Sort order"
          >
            <FilterSegmentItem name="order" value="desc" defaultChecked={order !== "asc"}>
              Desc
            </FilterSegmentItem>
            <FilterSegmentItem name="order" value="asc" defaultChecked={order === "asc"}>
              Asc
            </FilterSegmentItem>
          </FilterSegment>

          <FilterSubmitWrap>
            <FilterSubmitBtn>Apply</FilterSubmitBtn>
          </FilterSubmitWrap>
        </FilterRow>
      </FilterForm>
    </FiltersSortPanel>
  );
}
