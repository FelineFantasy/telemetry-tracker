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
  FilterSubmitBtn,
  FilterSubmitWrap,
} from "@/app/components/dashboard/list-filters-ui";
import {
  ListFiltersTimeRangeSection,
  listFiltersRangeSummary,
} from "@/app/components/dashboard/ListFiltersTimeRangeSection";
import { listTimeRangeHiddenFields, type ParsedTimeRange } from "@/lib/time-range";
import { releaseFilterSelectOptions } from "@/lib/overview-scope-url";

type Props = {
  path: string;
  currentParams: Record<string, string>;
  timeRange: ParsedTimeRange;
  fromParam: string;
  toParam: string;
  appFilter: string;
  environment: string;
  platform: string;
  release: string;
  chartBucket: string;
  environments: string[];
  platforms: string[];
  releases: string[];
};

export function PerformanceListToolbar({
  path,
  currentParams,
  timeRange,
  fromParam,
  toParam,
  appFilter,
  environment,
  platform,
  release,
  chartBucket,
  environments,
  platforms,
  releases,
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
  const releaseOptions: DashboardSelectOption[] = useMemo(
    () => releaseFilterSelectOptions(releases),
    [releases]
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
        {chartBucket ? <input type="hidden" name="chartBucket" value={chartBucket} /> : null}

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
            <FilterLabel id={id("rel-l")}>Release</FilterLabel>
            <DashboardCustomSelect
              name="release"
              value={release}
              options={releaseOptions}
              triggerId={id("rel-t")}
              listLabelledBy={id("rel-l")}
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
