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

const SORT_OPTIONS: DashboardSelectOption[] = [
  { value: "created_at", label: "Created" },
  { value: "name", label: "Name" },
  { value: "app", label: "App" },
  { value: "environment", label: "Environment" },
  { value: "platform", label: "Platform" },
  { value: "release", label: "Release" },
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

export function EventsListToolbar({
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
  const fieldIds = useId();
  const rangeSummary = listFiltersRangeSummary(customRange, from, to);

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
    () => [
      { value: "", label: "Any" },
      ...releases.map((e) => ({ value: e, label: e })),
    ],
    [releases]
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
            <FilterLabel>Event name</FilterLabel>
            <FilterInput
              type="search"
              name="name"
              defaultValue={name}
              placeholder="e.g. screen_view"
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

        <FilterRow>
          <FilterField>
            <FilterLabel id={id("sort-l")}>Sort by</FilterLabel>
            <DashboardCustomSelect
              name="sort"
              value={sort || "created_at"}
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
