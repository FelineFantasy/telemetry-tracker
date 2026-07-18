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
import { listTimeRangeHiddenFields, type ParsedTimeRange } from "@/lib/time-range";
import { ClientListSortRow } from "@/app/components/dashboard/ClientListSortRow";
import { releaseFilterSelectOptions } from "@/lib/overview-scope-url";

export const EVENTS_SORT_OPTIONS: DashboardSelectOption[] = [
  { value: "last_seen", label: "Last seen" },
  { value: "first_seen", label: "First seen" },
  { value: "count", label: "Count" },
  { value: "name", label: "Name" },
  { value: "users", label: "Users" },
  { value: "sessions", label: "Sessions" },
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
  name: string;
  environment: string;
  platform: string;
  release: string;
  propertiesContains: string;
  q: string;
  sort: string;
  order: string;
  environments: string[];
  platforms: string[];
  releases: string[];
  onSortApply?: (sort: string, order: string) => void;
  sortLoading?: boolean;
};

export function EventsListToolbar({
  path,
  currentParams,
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
  q,
  sort,
  order,
  environments,
  platforms,
  releases,
  onSortApply,
  sortLoading = false,
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
        {Number(pageSize) !== defaultPageSize ? (
          <input type="hidden" name="pageSize" value={pageSize} />
        ) : null}
        {onSortApply ? (
          <>
            <input type="hidden" name="sort" value={sort || "last_seen"} />
            <input type="hidden" name="order" value={order || "desc"} />
          </>
        ) : null}

        <FilterRow>
          <FilterField grow>
            <FilterLabel>Search</FilterLabel>
            <FilterInput
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Name or properties…"
              autoComplete="off"
            />
          </FilterField>
          <FilterField grow>
            <FilterLabel>Event name</FilterLabel>
            <FilterInput
              type="search"
              name="name"
              defaultValue={name}
              placeholder="Exact name…"
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
          {onSortApply ? (
            <FilterSubmitWrap>
              <FilterSubmitBtn>Apply filters</FilterSubmitBtn>
            </FilterSubmitWrap>
          ) : null}
        </FilterRow>

        <FilterRow>
          <FilterField grow>
            <FilterLabel>Properties (contains)</FilterLabel>
            <FilterInput
              type="search"
              name="propertiesContains"
              defaultValue={propertiesContains}
              placeholder="JSON substring…"
              autoComplete="off"
            />
          </FilterField>
        </FilterRow>

        {onSortApply ? (
          <ClientListSortRow
            sort={sort || "last_seen"}
            order={order}
            sortOptions={EVENTS_SORT_OPTIONS}
            onApply={onSortApply}
            isLoading={sortLoading}
          />
        ) : null}

        {!onSortApply ? (
        <FilterRow>
          <FilterField>
            <FilterLabel id={id("sort-l")}>Sort by</FilterLabel>
            <DashboardCustomSelect
              name="sort"
              value={sort || "last_seen"}
              options={EVENTS_SORT_OPTIONS}
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
        ) : null}
      </FilterForm>
    </FiltersSortPanel>
  );
}
