"use client";

import { useCallback, useId, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DashboardCustomSelect } from "@/app/components/dashboard/DashboardCustomSelect";
import type { DashboardSelectOption } from "@/app/components/dashboard/DashboardCustomSelect";
import { FiltersSortPanel } from "@/app/components/dashboard/FiltersSortPanel";
import {
  FilterField,
  FilterLabel,
  FilterRow,
  FilterSection,
  FilterSegment,
  FilterSegmentItem,
} from "@/app/components/dashboard/list-filters-ui";
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
      <div className="flex flex-col gap-4">
        <FilterSection label="Error groups">
          <FilterRow>
            <FilterField>
              <FilterLabel id={errSortId}>Sort by</FilterLabel>
              <DashboardCustomSelect
                value={errorsSort}
                options={ERR_SORT_OPTIONS}
                triggerId={errSortT}
                listLabelledBy={errSortId}
                onValueChange={(v) => push({ errorsSort: v, errorsPage: "1" })}
              />
            </FilterField>

            <FilterSegment
              legend="Order"
              title="Descending: largest counts and newest dates first. Ascending: the opposite."
              ariaLabel="Error groups sort order"
            >
              <FilterSegmentItem
                name={`overview-errors-order-${uid}`}
                value="desc"
                checked={errorsOrder === "desc"}
                onChange={() => push({ errorsOrder: "desc", errorsPage: "1" })}
              >
                Desc
              </FilterSegmentItem>
              <FilterSegmentItem
                name={`overview-errors-order-${uid}`}
                value="asc"
                checked={errorsOrder === "asc"}
                onChange={() => push({ errorsOrder: "asc", errorsPage: "1" })}
              >
                Asc
              </FilterSegmentItem>
            </FilterSegment>
          </FilterRow>
        </FilterSection>

        <FilterSection label="Top events">
          <FilterRow>
            <FilterField>
              <FilterLabel id={evSortId}>Sort by</FilterLabel>
              <DashboardCustomSelect
                value={topEventsSort}
                options={TOP_EV_SORT_OPTIONS}
                triggerId={evSortT}
                listLabelledBy={evSortId}
                onValueChange={(v) => push({ topEventsSort: v, eventsPage: "1" })}
              />
            </FilterField>

            <FilterSegment
              legend="Order"
              title="Descending: highest counts first. Ascending: lower counts or reverse name order."
              ariaLabel="Top events sort order"
            >
              <FilterSegmentItem
                name={`overview-events-order-${uid}`}
                value="desc"
                checked={topEventsOrder === "desc"}
                onChange={() => push({ topEventsOrder: "desc", eventsPage: "1" })}
              >
                Desc
              </FilterSegmentItem>
              <FilterSegmentItem
                name={`overview-events-order-${uid}`}
                value="asc"
                checked={topEventsOrder === "asc"}
                onChange={() => push({ topEventsOrder: "asc", eventsPage: "1" })}
              >
                Asc
              </FilterSegmentItem>
            </FilterSegment>
          </FilterRow>
        </FilterSection>
      </div>
    </FiltersSortPanel>
  );
}
