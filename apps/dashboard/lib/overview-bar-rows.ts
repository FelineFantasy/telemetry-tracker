/**
 * Pure helpers for overview horizontal bar charts — safe to import from Server Components.
 * (Do not import from `"use client"` modules into server pages.)
 */

export type OverviewBarRow = { label: string; value: number };

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function mapErrorGroupsToBarRows(
  groups: Array<{ message: string; occurrences: number }>,
  max = 10
): OverviewBarRow[] {
  return [...groups]
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, max)
    .map((g) => ({
      label: truncate(g.message, 42),
      value: g.occurrences,
    }));
}

export function mapTopEventsToBarRows(
  events: Array<{ name: string; count: number }>,
  max = 10
): OverviewBarRow[] {
  return [...events]
    .sort((a, b) => b.count - a.count)
    .slice(0, max)
    .map((e) => ({
      label: truncate(e.name, 42),
      value: e.count,
    }));
}
