"use client";

import { useId, useMemo } from "react";
import { DashboardCustomSelect } from "@/app/components/dashboard/DashboardCustomSelect";
import type { DashboardSelectOption } from "@/app/components/dashboard/DashboardCustomSelect";
import { FiltersSortPanel } from "@/app/components/dashboard/FiltersSortPanel";
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

      <form method="get" action={path} className="errors-filters__form">
        {appFilter ? <input type="hidden" name="app" value={appFilter} /> : null}
        {rangePreset && !customRange ? (
          <input type="hidden" name="range" value={rangePreset} />
        ) : null}
        {customRange && from ? <input type="hidden" name="from" value={from} /> : null}
        {customRange && to ? <input type="hidden" name="to" value={to} /> : null}
        {Number(pageSize) !== defaultPageSize ? (
          <input type="hidden" name="pageSize" value={pageSize} />
        ) : null}

        <div className="errors-filters__row errors-filters__row--search">
          <label className="errors-filters__field errors-filters__field--grow">
            <span className="errors-filters__label">Event name</span>
            <input
              type="search"
              name="name"
              className="errors-filters__input errors-filters__input--search"
              defaultValue={name}
              placeholder="e.g. screen_view"
              autoComplete="off"
            />
          </label>
          <label className="errors-filters__field">
            <span className="errors-filters__label" id={id("env-l")}>
              Environment
            </span>
            <DashboardCustomSelect
              name="environment"
              value={environment}
              options={environmentOptions}
              triggerId={id("env-t")}
              listLabelledBy={id("env-l")}
            />
          </label>
          <label className="errors-filters__field">
            <span className="errors-filters__label" id={id("plat-l")}>
              Platform
            </span>
            <DashboardCustomSelect
              name="platform"
              value={platform}
              options={platformOptions}
              triggerId={id("plat-t")}
              listLabelledBy={id("plat-l")}
            />
          </label>
          <label className="errors-filters__field">
            <span className="errors-filters__label" id={id("rel-l")}>
              Release
            </span>
            <DashboardCustomSelect
              name="release"
              value={release}
              options={releaseOptions}
              triggerId={id("rel-t")}
              listLabelledBy={id("rel-l")}
            />
          </label>
        </div>

        <div className="errors-filters__row">
          <label className="errors-filters__field errors-filters__field--grow">
            <span className="errors-filters__label">Properties (contains)</span>
            <input
              type="search"
              name="propertiesContains"
              className="errors-filters__input"
              defaultValue={propertiesContains}
              placeholder="JSON substring…"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="errors-filters__row errors-filters__row--sort">
          <label className="errors-filters__field">
            <span className="errors-filters__label" id={id("sort-l")}>
              Sort by
            </span>
            <DashboardCustomSelect
              name="sort"
              value={sort || "created_at"}
              options={SORT_OPTIONS}
              triggerId={id("sort-t")}
              listLabelledBy={id("sort-l")}
            />
          </label>

          <fieldset
            className="errors-filters__fieldset"
            title="Descending vs ascending order for the selected column."
          >
            <legend className="errors-filters__label">Order</legend>
            <div className="errors-filters__segment" role="group" aria-label="Sort order">
              <label className="errors-filters__segment-item">
                <input type="radio" name="order" value="desc" defaultChecked={order !== "asc"} />
                <span>Desc</span>
              </label>
              <label className="errors-filters__segment-item">
                <input type="radio" name="order" value="asc" defaultChecked={order === "asc"} />
                <span>Asc</span>
              </label>
            </div>
          </fieldset>

          <div className="errors-filters__submit-wrap">
            <button type="submit" className="errors-filters__btn errors-filters__btn--primary errors-filters__btn--submit">
              Apply
            </button>
          </div>
        </div>
      </form>
    </FiltersSortPanel>
  );
}
