"use client";

import { TimeRangePicker } from "@/app/components/dashboard/TimeRangePicker";
import { FilterSection } from "@/app/components/dashboard/list-filters-ui";
import { isUnselectedTimeRange, type ParsedTimeRange } from "@/lib/time-range";

export function ListFiltersTimeRangeSection({
  path,
  currentParams,
  parsedRange,
  includeAll = false,
}: {
  path: string;
  currentParams: Record<string, string>;
  parsedRange: Pick<ParsedTimeRange, "key" | "label" | "shortLabel"> & {
    gte: string;
    lte: string;
  };
  includeAll?: boolean;
}) {
  return (
    <FilterSection label="Time range">
      <TimeRangePicker
        path={path}
        currentParams={currentParams}
        range={parsedRange}
        includeAll={includeAll}
      />
    </FilterSection>
  );
}

export function listFiltersRangeSummary(rangeKey: string, rangeLabel: string): string | null {
  if (isUnselectedTimeRange(rangeKey)) return null;
  return rangeLabel;
}
