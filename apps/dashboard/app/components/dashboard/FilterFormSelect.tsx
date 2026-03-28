"use client";

import { useId, useMemo } from "react";
import { DashboardCustomSelect } from "@/app/components/dashboard/DashboardCustomSelect";

/**
 * Any + string list — same dropdown UX as errors filters (opens below, GET form `name`).
 */
export function FilterFormSelect({
  name,
  value,
  items,
  label,
  emptyLabel = "Any",
}: {
  name: string;
  value: string;
  items: string[];
  label: string;
  emptyLabel?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const labelId = `ffs-l-${name}-${uid}`;
  const triggerId = `ffs-t-${name}-${uid}`;

  const options = useMemo(
    () => [
      { value: "", label: emptyLabel },
      ...items.map((i) => ({ value: i, label: i })),
    ],
    [items, emptyLabel]
  );

  return (
    <>
      <span className="filter-label" id={labelId}>
        {label}
      </span>
      <DashboardCustomSelect
        name={name}
        value={value}
        options={options}
        triggerId={triggerId}
        listLabelledBy={labelId}
      />
    </>
  );
}
