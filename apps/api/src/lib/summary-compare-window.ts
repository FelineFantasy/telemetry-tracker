/**
 * Apply compare mode on top of a page summary's default window (#495).
 */

import {
  parseCompareMode,
  resolveCompareWindows,
  type CompareMode,
  type CustomCompareInput,
  type ResolvedCompareWindows,
} from "./compare-windows.js";

export type SummaryWindowBase = {
  since: Date;
  until: Date;
  previousSince: Date;
  previousUntil: Date;
  label: string;
  compareLabel: string;
};

export type SummaryCompareQuery = {
  compare?: string | null;
  compareFrom?: string | null;
  compareTo?: string | null;
};

export type ApplySummaryCompareResult =
  | { ok: true; window: SummaryWindowBase; mode: CompareMode }
  | { ok: false; error: string };

/**
 * Re-resolve previous (and optionally current) windows from a compare mode.
 * Calendar / custom modes may replace the primary window; rolling modes only
 * replace the previous window + compareLabel.
 */
export function applySummaryCompare(
  base: SummaryWindowBase,
  query: SummaryCompareQuery = {},
  anchor: Date = base.until
): ApplySummaryCompareResult {
  const mode = parseCompareMode(query.compare);
  const custom: CustomCompareInput = {
    compareFrom: query.compareFrom,
    compareTo: query.compareTo,
  };
  const resolved = resolveCompareWindows({
    mode,
    since: base.since,
    until: base.until,
    label: base.label,
    anchor,
    custom,
  });
  if (!resolved.ok) return resolved;
  return { ok: true, window: toSummaryWindow(resolved.windows), mode };
}

function toSummaryWindow(w: ResolvedCompareWindows): SummaryWindowBase {
  return {
    since: w.since,
    until: w.until,
    previousSince: w.previousSince,
    previousUntil: w.previousUntil,
    label: w.label,
    compareLabel: w.compareLabel,
  };
}
