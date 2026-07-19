"use client";

import { useRouter } from "next/navigation";
import {
  mergeOverviewScopeQuery,
  parseOverviewCompare,
  type OverviewCompareParam,
} from "@/lib/overview-scope-url";

const COMPARE_OPTIONS: Array<{ value: OverviewCompareParam; label: string }> = [
  { value: "previous", label: "vs previous period" },
  { value: "week-ago", label: "vs same window last week" },
  { value: "today-yesterday", label: "Today vs Yesterday" },
  { value: "week", label: "This week vs Last week" },
  { value: "month", label: "This month vs Last month" },
  { value: "custom", label: "Custom equal ranges" },
];

/**
 * Shared compare-mode control for Overview / Errors / Events / Sessions (#495).
 * Preserves existing scope query params when switching modes.
 * Calendar presets use UTC boundaries (documented in API compare-windows).
 */
export function CompareModeControl({
  path,
  currentParams,
  value,
  showCustomHint = true,
}: {
  path: string;
  currentParams: Record<string, string>;
  value?: OverviewCompareParam;
  showCustomHint?: boolean;
}) {
  const router = useRouter();
  const compare = value ?? parseOverviewCompare(currentParams.compare);

  function setCompare(next: OverviewCompareParam) {
    const updates: Parameters<typeof mergeOverviewScopeQuery>[2] = {
      compare: next === "previous" ? null : next,
    };
    if (next !== "custom") {
      updates.compareFrom = null;
      updates.compareTo = null;
    }
    router.push(mergeOverviewScopeQuery(path, currentParams, updates));
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <label className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
        <span className="shrink-0">Compare</span>
        <select
          className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] text-foreground shadow-sm"
          value={compare}
          aria-label="Comparison mode"
          onChange={(e) => setCompare(parseOverviewCompare(e.target.value))}
        >
          {COMPARE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      {showCustomHint && compare === "custom" ? (
        <p className="text-[11px] text-muted-foreground">
          Set equal-duration <code className="text-[10px]">compareFrom</code> /{" "}
          <code className="text-[10px]">compareTo</code> query params (UTC).
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer CompareModeControl — kept for Overview call-site compatibility. */
export function OverviewCompareToggle({
  value,
  overviewPath,
  currentParams,
}: {
  value: OverviewCompareParam;
  overviewPath: string;
  currentParams: Record<string, string>;
}) {
  return (
    <CompareModeControl
      path={overviewPath}
      currentParams={currentParams}
      value={value}
    />
  );
}
