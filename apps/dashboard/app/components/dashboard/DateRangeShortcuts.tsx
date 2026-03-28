import Link from "next/link";
import { DATE_RANGE_PRESETS } from "@/lib/date-range-presets";
import { mergeListQuery } from "@/lib/list-filters-url";

export function DateRangeShortcuts({
  path,
  currentParams,
  activePreset,
  customRange,
}: {
  path: string;
  currentParams: Record<string, string>;
  /** Which preset matches the current API filter (e.g. `all`, `24h`, or `custom`). */
  activePreset: string;
  /** When true, preset links are not marked current (custom from/to in use). */
  customRange?: boolean;
}) {
  return (
    <div className="filter-shortcuts filter-shortcuts--range" role="group" aria-label="Time range">
      <span className="filter-shortcuts__label">Range</span>
      <div className="filter-shortcuts__links">
        {DATE_RANGE_PRESETS.map(({ range, label }) => {
          const href = mergeListQuery(path, currentParams, {
            range,
            from: null,
            to: null,
          });
          const isCurrent = !customRange && activePreset === range;
          return (
            <Link
              key={range}
              href={href}
              className={`filter-shortcuts__link${isCurrent ? " filter-shortcuts__link--current" : ""}`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** When `from`/`to` set, treat as custom; else normalize `range` with default for resource. */
export function effectiveListRange(
  params: { range?: string; from?: string; to?: string },
  defaultRange: string
): { activePreset: string; customRange: boolean } {
  if (params.from?.trim() || params.to?.trim()) {
    return { activePreset: "custom", customRange: true };
  }
  const r = params.range?.trim();
  if (r === "24h" || r === "7d" || r === "30d" || r === "90d" || r === "all") {
    return { activePreset: r, customRange: false };
  }
  return { activePreset: defaultRange, customRange: false };
}
