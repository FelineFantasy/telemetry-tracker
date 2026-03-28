"use client";

import { useId } from "react";
import { DashboardCustomSelect } from "@/app/components/dashboard/DashboardCustomSelect";
import type { DashboardSelectOption } from "@/app/components/dashboard/DashboardCustomSelect";

const ORDER_OPTIONS: DashboardSelectOption[] = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
];

/**
 * GET form fields: `sort` + `order` with the same dropdown UX as errors filters.
 */
export function SortOrderSelects({
  sortValue,
  orderValue,
  sortOptions,
  sortFieldName = "sort",
  orderFieldName = "order",
}: {
  sortValue: string;
  orderValue: string;
  sortOptions: DashboardSelectOption[];
  sortFieldName?: string;
  orderFieldName?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const sortLabelId = `sos-sl-${uid}`;
  const sortTriggerId = `sos-st-${uid}`;
  const ordLabelId = `sos-ol-${uid}`;
  const ordTriggerId = `sos-ot-${uid}`;

  return (
    <>
      <span className="filter-label" id={sortLabelId}>
        Sort by
      </span>
      <DashboardCustomSelect
        name={sortFieldName}
        value={sortValue}
        options={sortOptions}
        triggerId={sortTriggerId}
        listLabelledBy={sortLabelId}
      />
      <span className="filter-label" id={ordLabelId}>
        Order
      </span>
      <DashboardCustomSelect
        name={orderFieldName}
        value={orderValue}
        options={ORDER_OPTIONS}
        triggerId={ordTriggerId}
        listLabelledBy={ordLabelId}
      />
    </>
  );
}
