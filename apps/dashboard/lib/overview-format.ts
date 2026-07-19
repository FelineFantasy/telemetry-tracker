export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatDeltaPct(pct: number): { text: string; tone: "up" | "down" | "flat" } {
  if (pct === 0) return { text: "—", tone: "flat" };
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return {
    text: `${sign}${Math.abs(pct).toFixed(1)}%`,
    tone: pct > 0 ? "up" : "down",
  };
}

/**
 * @deprecated Prefer `formatRelativeDelta` from compare-format (#495).
 * Kept for call sites that still expect a numeric % (0→N maps to 100 historically).
 */
export function calcDeltaPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function formatRatePerSec(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K /s`;
  if (n >= 10) return `${n.toFixed(0)} /s`;
  if (n >= 1) return `${n.toFixed(1)} /s`;
  return `${n.toFixed(2)} /s`;
}

export function formatPct(n: number, digits = 2): string {
  return `${n.toFixed(digits)}%`;
}

export function formatSignedPct(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${Math.abs(n).toFixed(1)}%`;
}
