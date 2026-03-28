"use client";

import { useCallback, useId, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DashboardCustomSelect } from "@/app/components/dashboard/DashboardCustomSelect";
import type { DashboardSelectOption } from "@/app/components/dashboard/DashboardCustomSelect";
import { FiltersSortPanel } from "@/app/components/dashboard/FiltersSortPanel";
import { mergeListQuery } from "@/lib/list-filters-url";

const ERR_SORT_OPTIONS: DashboardSelectOption[] = [
  { value: "occurrences", label: "Occurrences" },
  { value: "last_seen", label: "Last seen" },
  { value: "first_seen", label: "First seen" },
  { value: "message", label: "Message" },
  { value: "app", label: "App" },
];

const TOP_EV_SORT_OPTIONS: DashboardSelectOption[] = [
  { value: "count", label: "Event count" },
  { value: "name", label: "Name" },
];

export function OverviewSortControls({
  path,
  currentParams,
  errorsSort,
  errorsOrder,
  topEventsSort,
  topEventsOrder,
}: {
  path: string;
  currentParams: Record<string, string>;
  errorsSort: string;
  errorsOrder: string;
  topEventsSort: string;
  topEventsOrder: string;
}) {
  const router = useRouter();
  const uid = useId().replace(/:/g, "");

  const push = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      router.push(mergeListQuery(path, currentParams, updates));
    },
    [router, path, currentParams]
  );

  const errSortId = useMemo(() => `ov-es-l-${uid}`, [uid]);
  const errSortT = useMemo(() => `ov-es-t-${uid}`, [uid]);
  const evSortId = useMemo(() => `ov-ts-l-${uid}`, [uid]);
  const evSortT = useMemo(() => `ov-ts-t-${uid}`, [uid]);

  return (
    <FiltersSortPanel rangeSummary={null}>
      <div className="errors-filters__form">
        <div className="errors-filters__section">
          <span className="errors-filters__section-label">Error groups</span>
          <div className="errors-filters__row errors-filters__row--sort">
            <label className="errors-filters__field">
              <span className="errors-filters__label" id={errSortId}>
                Sort by
              </span>
              <DashboardCustomSelect
                value={errorsSort}
                options={ERR_SORT_OPTIONS}
                triggerId={errSortT}
                listLabelledBy={errSortId}
                onValueChange={(v) => push({ errorsSort: v, errorsPage: "1" })}
              />
            </label>

            <fieldset
              className="errors-filters__fieldset"
              title="Descending: largest counts and newest dates first. Ascending: the opposite."
            >
              <legend className="errors-filters__label">Order</legend>
              <div className="errors-filters__segment" role="group" aria-label="Error groups sort order">
                <label className="errors-filters__segment-item">
                  <input
                    type="radio"
                    name={`overview-errors-order-${uid}`}
                    value="desc"
                    checked={errorsOrder === "desc"}
                    onChange={() => push({ errorsOrder: "desc", errorsPage: "1" })}
                  />
                  <span>Desc</span>
                </label>
                <label className="errors-filters__segment-item">
                  <input
                    type="radio"
                    name={`overview-errors-order-${uid}`}
                    value="asc"
                    checked={errorsOrder === "asc"}
                    onChange={() => push({ errorsOrder: "asc", errorsPage: "1" })}
                  />
                  <span>Asc</span>
                </label>
              </div>
            </fieldset>
          </div>
        </div>

        <div className="errors-filters__section">
          <span className="errors-filters__section-label">Top events</span>
          <div className="errors-filters__row errors-filters__row--sort">
            <label className="errors-filters__field">
              <span className="errors-filters__label" id={evSortId}>
                Sort by
              </span>
              <DashboardCustomSelect
                value={topEventsSort}
                options={TOP_EV_SORT_OPTIONS}
                triggerId={evSortT}
                listLabelledBy={evSortId}
                onValueChange={(v) => push({ topEventsSort: v, eventsPage: "1" })}
              />
            </label>

            <fieldset
              className="errors-filters__fieldset"
              title="Descending: highest counts first. Ascending: lower counts or reverse name order."
            >
              <legend className="errors-filters__label">Order</legend>
              <div className="errors-filters__segment" role="group" aria-label="Top events sort order">
                <label className="errors-filters__segment-item">
                  <input
                    type="radio"
                    name={`overview-events-order-${uid}`}
                    value="desc"
                    checked={topEventsOrder === "desc"}
                    onChange={() => push({ topEventsOrder: "desc", eventsPage: "1" })}
                  />
                  <span>Desc</span>
                </label>
                <label className="errors-filters__segment-item">
                  <input
                    type="radio"
                    name={`overview-events-order-${uid}`}
                    value="asc"
                    checked={topEventsOrder === "asc"}
                    onChange={() => push({ topEventsOrder: "asc", eventsPage: "1" })}
                  />
                  <span>Asc</span>
                </label>
              </div>
            </fieldset>
          </div>
        </div>
      </div>
    </FiltersSortPanel>
  );
}
