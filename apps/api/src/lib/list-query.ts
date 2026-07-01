import { parseTimeRangeQuery } from "./time-range.js";

/** Presets: relative window, or "all" for no lower bound. */
export type RangePreset = "all" | "1h" | "24h" | "7d" | "14d" | "30d" | "90d" | string;

/**
 * List endpoints: optional `from` / `to` (ISO) override `range`.
 * Supports flexible relative tokens (2h, 8w) via shared time-range parser.
 * `defaultPreset` when `range` is omitted (errors/events: all; sessions: 24h).
 */
export function parseCreatedRange(
  query: {
    range?: string;
    from?: string;
    to?: string;
  },
  defaultPreset: RangePreset = "all"
): { gte?: Date; lte?: Date } {
  const fromRaw = query.from?.trim();
  const toRaw = query.to?.trim();
  const rangeRaw = query.range?.trim();

  if (fromRaw || toRaw) {
    const parsed = parseTimeRangeQuery({ from: fromRaw, to: toRaw }, new Date(), "24h");
    if (parsed.ok) return { gte: parsed.range.gte, lte: parsed.range.lte };
    const gte = fromRaw ? new Date(fromRaw) : undefined;
    const lte = toRaw ? endOfDayIfDateOnly(toRaw) : undefined;
    const out: { gte?: Date; lte?: Date } = {};
    if (gte && !Number.isNaN(gte.getTime())) out.gte = gte;
    if (lte && !Number.isNaN(lte.getTime())) out.lte = lte;
    return out;
  }

  const effectiveRange = rangeRaw || defaultPreset;
  if (effectiveRange === "all") return {};

  const parsed = parseTimeRangeQuery({ range: effectiveRange }, new Date(), "24h");
  if (!parsed.ok) {
    if (defaultPreset === "all") return {};
    const fallback = parseTimeRangeQuery(
      { range: defaultPreset === "all" ? "24h" : defaultPreset },
      new Date(),
      "24h"
    );
    if (fallback.ok) return { gte: fallback.range.gte, lte: fallback.range.lte };
    return {};
  }
  return { gte: parsed.range.gte, lte: parsed.range.lte };
}

/** If value is YYYY-MM-DD only, use end of that day (UTC) for inclusive upper bounds. */
export function endOfDayIfDateOnly(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Date(`${iso}T23:59:59.999Z`);
  }
  return new Date(iso);
}

export function escapeLikePattern(user: string): string {
  return user.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
