"use client";

import { useCallback, useId, useMemo } from "react";
import { useRouter } from "next/navigation";
import { DashboardCustomSelect } from "@/app/components/dashboard/DashboardCustomSelect";
import type { DashboardSelectOption } from "@/app/components/dashboard/DashboardCustomSelect";
import { mergeListQuery } from "@/lib/list-filters-url";

const ORDER_OPTIONS: DashboardSelectOption[] = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
];

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
  const errOrdId = useMemo(() => `ov-eo-l-${uid}`, [uid]);
  const errOrdT = useMemo(() => `ov-eo-t-${uid}`, [uid]);
  const evSortId = useMemo(() => `ov-ts-l-${uid}`, [uid]);
  const evSortT = useMemo(() => `ov-ts-t-${uid}`, [uid]);
  const evOrdId = useMemo(() => `ov-to-l-${uid}`, [uid]);
  const evOrdT = useMemo(() => `ov-to-t-${uid}`, [uid]);

  return (
    <div className="overview-sort-tools">
      <div className="overview-sort-tools__group" aria-label="Top error groups sort">
        <span className="overview-sort-tools__heading">Error groups</span>
        <span className="filter-label" id={errSortId}>
          Sort by
        </span>
        <DashboardCustomSelect
          value={errorsSort}
          options={ERR_SORT_OPTIONS}
          triggerId={errSortT}
          listLabelledBy={errSortId}
          onValueChange={(v) =>
            push({ errorsSort: v, errorsPage: "1" })
          }
        />
        <span className="filter-label" id={errOrdId}>
          Order
        </span>
        <DashboardCustomSelect
          value={errorsOrder}
          options={ORDER_OPTIONS}
          triggerId={errOrdT}
          listLabelledBy={errOrdId}
          onValueChange={(v) =>
            push({ errorsOrder: v, errorsPage: "1" })
          }
        />
      </div>
      <div className="overview-sort-tools__group" aria-label="Top event names sort">
        <span className="overview-sort-tools__heading">Top events</span>
        <span className="filter-label" id={evSortId}>
          Sort by
        </span>
        <DashboardCustomSelect
          value={topEventsSort}
          options={TOP_EV_SORT_OPTIONS}
          triggerId={evSortT}
          listLabelledBy={evSortId}
          onValueChange={(v) =>
            push({ topEventsSort: v, eventsPage: "1" })
          }
        />
        <span className="filter-label" id={evOrdId}>
          Order
        </span>
        <DashboardCustomSelect
          value={topEventsOrder}
          options={ORDER_OPTIONS}
          triggerId={evOrdT}
          listLabelledBy={evOrdId}
          onValueChange={(v) =>
            push({ topEventsOrder: v, eventsPage: "1" })
          }
        />
      </div>
    </div>
  );
}
