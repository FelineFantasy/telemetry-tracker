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
  activePreset: string;
  customRange: boolean;
  rangePreset: string;
  appFilter: string;
  pageSize: string;
  defaultPageSize: number;
  from: string;
  to: string;
  platform: string;
  sort: string;
  order: string;
  platforms: string[];
};

export function SessionsListToolbar({
  path,
  currentParams,
  activePreset,
  customRange,
  rangePreset,
  appFilter,
  pageSize,
  defaultPageSize,
  from,
  to,
  platform,
  sort,
  order,
  platforms,
}: Props) {
  const fieldIds = useId();
  const rangeSummary = listFiltersRangeSummary(customRange, from, to);

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
        activePreset={activePreset}
        customRange={customRange}
        from={from}
        to={to}
      />

      <FilterForm method="get" action={path}>
        {appFilter ? <input type="hidden" name="app" value={appFilter} /> : null}
        {rangePreset && !customRange ? (
          <input type="hidden" name="range" value={rangePreset} />
        ) : null}
        {customRange && from ? <input type="hidden" name="from" value={from} /> : null}
        {customRange && to ? <input type="hidden" name="to" value={to} /> : null}
        {Number(pageSize) !== defaultPageSize ? (
          <input type="hidden" name="pageSize" value={pageSize} />
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
