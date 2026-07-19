/**
 * Shared percentage / pp delta formatting for period comparisons (#495).
 *
 * Rules:
 * - `0 → N>0` → "New" (never ÷0)
 * - `0 → 0` → "—"
 * - Missing / incomparable → "—"
 * - Counts use `%`; rates already as percentages use `pp`
 */

export type DeltaTone = "up" | "down" | "flat" | "new";

export type FormattedDelta = {
  text: string;
  tone: DeltaTone;
};

export function calcDeltaPctOrNew(
  current: number,
  previous: number
): { kind: "pct"; value: number } | { kind: "new" } | { kind: "none" } {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { kind: "none" };
  }
  if (previous <= 0) {
    if (current > 0) return { kind: "new" };
    return { kind: "none" };
  }
  return { kind: "pct", value: ((current - previous) / previous) * 100 };
}

/** Relative % delta for absolute counts. */
export function formatRelativeDelta(
  current: number,
  previous: number
): FormattedDelta {
  const result = calcDeltaPctOrNew(current, previous);
  if (result.kind === "new") return { text: "New", tone: "new" };
  if (result.kind === "none") return { text: "—", tone: "flat" };
  if (Math.abs(result.value) < 0.05) return { text: "—", tone: "flat" };
  const sign = result.value > 0 ? "+" : result.value < 0 ? "−" : "";
  return {
    text: `${sign}${Math.abs(result.value).toFixed(1)}%`,
    tone: result.value > 0 ? "up" : "down",
  };
}

/** Percentage-point delta for rate metrics (error rate, etc.). */
export function formatPpDelta(
  current: number | null | undefined,
  previous: number | null | undefined
): FormattedDelta {
  if (
    current == null ||
    previous == null ||
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  ) {
    return { text: "—", tone: "flat" };
  }
  const deltaPp = current - previous;
  if (Math.abs(deltaPp) < 0.05) return { text: "—", tone: "flat" };
  const sign = deltaPp > 0 ? "+" : deltaPp < 0 ? "−" : "";
  return {
    text: `${sign}${Math.abs(deltaPp).toFixed(1)} pp`,
    tone: deltaPp > 0 ? "up" : "down",
  };
}

export function formatNullablePctDelta(
  value: number | null | undefined
): FormattedDelta {
  if (value == null || !Number.isFinite(value)) {
    return { text: "—", tone: "flat" };
  }
  if (Math.abs(value) < 0.05) return { text: "—", tone: "flat" };
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return {
    text: `${sign}${Math.abs(value).toFixed(1)}%`,
    tone: value > 0 ? "up" : "down",
  };
}

export function deltaToneClass(
  tone: DeltaTone,
  invert = false
): string {
  if (tone === "flat" || tone === "new") return "text-muted-foreground";
  if (tone === "up") return invert ? "text-destructive" : "text-success";
  return invert ? "text-success" : "text-destructive";
}

export function deltaArrow(tone: DeltaTone): string {
  if (tone === "up") return "▲";
  if (tone === "down") return "▼";
  if (tone === "new") return "●";
  return "—";
}
