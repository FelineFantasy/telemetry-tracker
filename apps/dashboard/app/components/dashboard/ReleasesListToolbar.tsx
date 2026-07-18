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

type Props = {
  path: string;
  currentParams: Record<string, string>;
  timeRange: ParsedTimeRange;
  fromParam: string;
  toParam: string;
  appFilter: string;
  environment: string;
  platform: string;
  sort: string;
  order: string;
  environments: string[];
  platforms: string[];
};

const SORT_OPTIONS: DashboardSelectOption[] = [
  { value: "recency", label: "Recency (first seen)" },
  { value: "adoption", label: "Adoption" },
  { value: "errors", label: "Error count" },
  { value: "error_rate", label: "Error rate" },
];

export function ReleasesListToolbar({
  path,
  currentParams,
  timeRange,
  fromParam,
  toParam,
  appFilter,
  environment,
  platform,
  sort,
  order,
  environments,
  platforms,
}: Props) {
  const fieldIds = useId();
  const rangeSummary = listFiltersRangeSummary(timeRange.key, timeRange.label);
  const timeHidden = listTimeRangeHiddenFields(
    timeRange,
    fromParam,
    toParam,
    currentParams.metricsUntil
  );
  const pickerRange = {
    key: timeRange.key,
    label: timeRange.label,
    shortLabel: timeRange.shortLabel,
    gte: fromParam || timeRange.gte.toISOString(),
    lte: toParam || timeRange.lte.toISOString(),
  };

  const environmentOptions: DashboardSelectOption[] = useMemo(
    () => [
      { value: "", label: "Any" },
      ...environments.map((e) => ({ value: e, label: e })),
    ],
    [environments]
  );
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

        <FilterRow>
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
            <FilterLabel id={id("plat-l")}>Platform</FilterLabel>
            <DashboardCustomSelect
              name="platform"
              value={platform}
              options={platformOptions}
              triggerId={id("plat-t")}
              listLabelledBy={id("plat-l")}
            />
          </FilterField>
          <FilterField>
            <FilterLabel id={id("sort-l")}>Sort by</FilterLabel>
            <DashboardCustomSelect
              name="sort"
              value={sort}
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
            <FilterSegmentItem name="order" value="desc" checked={order !== "asc"}>
              Desc
            </FilterSegmentItem>
            <FilterSegmentItem name="order" value="asc" checked={order === "asc"}>
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
