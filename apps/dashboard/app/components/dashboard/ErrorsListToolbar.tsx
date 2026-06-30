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

type Props = {
  path: string;
  currentParams: Record<string, string>;
  activePreset: string;
  customRange: boolean;
  /** Current `range` query value when using presets (omit when empty). */
  rangePreset: string;
  appFilter: string;
  pageSize: string;
  defaultPageSize: number;
  from: string;
  to: string;
  q: string;
  environment: string;
  status: string;
  sort: string;
  order: string;
  trendWindow: string;
  environments: string[];
};

export function ErrorsListToolbar({
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
  q,
  environment,
  status,
  sort,
  order,
  trendWindow,
  environments,
}: Props) {
  const fieldIds = useId();

  const rangeSummary = listFiltersRangeSummary(customRange, from, to);

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

          <FilterSegment legend="Trend window" ariaLabel="Trend comparison window">
            <FilterSegmentItem name="trendWindow" value="24h" defaultChecked={trendWindow !== "7d"}>
              24h
            </FilterSegmentItem>
            <FilterSegmentItem name="trendWindow" value="7d" defaultChecked={trendWindow === "7d"}>
              7d
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
