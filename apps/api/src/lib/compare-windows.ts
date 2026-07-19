/**
 * Shared period-comparison window resolution (#495).
 *
 * Timezone: all calendar presets (today / week / month) use **UTC** day and
 * ISO-week boundaries. There is no project/org timezone preference yet; this
 * matches existing chart bucketing (`AT TIME ZONE 'UTC'`) and billing months.
 *
 * Rolling modes (`previous`, `week-ago`) keep the caller's current window and
 * derive an equal-length baseline. Calendar modes set both current and compare
 * windows from the anchor instant.
 */

export const COMPARE_MODES = [
  "previous",
  "week-ago",
  "today-yesterday",
  "week",
  "month",
  "custom",
] as const;

export type CompareMode = (typeof COMPARE_MODES)[number];

/** Rolling compare modes that keep the caller's primary window. */
export type RollingCompareMode = "previous" | "week-ago";

/** @deprecated Prefer CompareMode — kept for Overview call sites. */
export type OverviewCompareMode = RollingCompareMode;

export type ResolvedCompareWindows = {
  since: Date;
  until: Date;
  previousSince: Date;
  previousUntil: Date;
  label: string;
  compareLabel: string;
  mode: CompareMode;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
/** Tolerate sub-second clock skew when enforcing equal-duration custom ranges. */
const EQUAL_DURATION_TOLERANCE_MS = 1000;

export function parseCompareMode(raw: string | undefined | null): CompareMode {
  const value = raw?.trim().toLowerCase() ?? "";
  if ((COMPARE_MODES as readonly string[]).includes(value)) {
    return value as CompareMode;
  }
  return "previous";
}

export function isRollingCompareMode(mode: CompareMode): mode is RollingCompareMode {
  return mode === "previous" || mode === "week-ago";
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** ISO week starts Monday 00:00 UTC. */
export function startOfUtcIsoWeek(d: Date): Date {
  const day = startOfUtcDay(d);
  const dow = day.getUTCDay(); // 0=Sun … 6=Sat
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  return new Date(day.getTime() - daysFromMonday * DAY_MS);
}

export function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function durationsEqual(
  aMs: number,
  bMs: number,
  toleranceMs = EQUAL_DURATION_TOLERANCE_MS
): boolean {
  return Math.abs(aMs - bMs) <= toleranceMs;
}

export type CustomCompareInput = {
  compareFrom?: string | null;
  compareTo?: string | null;
};

function parseBound(raw: string | undefined | null): Date | null {
  const value = raw?.trim();
  if (!value) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00.000Z`)
    : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function endOfDayUtcIfDateOnly(raw: string, parsed: Date): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return new Date(`${raw.trim()}T23:59:59.999Z`);
  }
  return parsed;
}

export type ResolveCompareWindowsInput = {
  mode: CompareMode;
  /** Primary window from the page range (used for rolling / custom current). */
  since: Date;
  until: Date;
  /** Default label when not overridden by calendar presets. */
  label?: string;
  anchor?: Date;
  custom?: CustomCompareInput;
};

export type ResolveCompareWindowsResult =
  | { ok: true; windows: ResolvedCompareWindows }
  | { ok: false; error: string };

/**
 * Resolve current + compare windows for a compare mode.
 * Calendar presets ignore the caller `since`/`until` and derive both from `anchor` (UTC).
 */
export function resolveCompareWindows(
  input: ResolveCompareWindowsInput
): ResolveCompareWindowsResult {
  const anchor = input.anchor ?? input.until;
  const baseLabel = input.label ?? "Selected period";

  if (input.mode === "today-yesterday") {
    const since = startOfUtcDay(anchor);
    const until = anchor;
    const durationMs = Math.max(until.getTime() - since.getTime(), 1);
    const previousSince = new Date(since.getTime() - DAY_MS);
    const previousUntil = new Date(previousSince.getTime() + durationMs);
    return {
      ok: true,
      windows: {
        since,
        until,
        previousSince,
        previousUntil,
        label: "Today",
        compareLabel: "vs yesterday",
        mode: input.mode,
      },
    };
  }

  if (input.mode === "week") {
    const since = startOfUtcIsoWeek(anchor);
    const until = anchor;
    const durationMs = Math.max(until.getTime() - since.getTime(), 1);
    const previousSince = new Date(since.getTime() - WEEK_MS);
    const previousUntil = new Date(previousSince.getTime() + durationMs);
    return {
      ok: true,
      windows: {
        since,
        until,
        previousSince,
        previousUntil,
        label: "This week",
        compareLabel: "vs last week",
        mode: input.mode,
      },
    };
  }

  if (input.mode === "month") {
    const since = startOfUtcMonth(anchor);
    const until = anchor;
    const durationMs = Math.max(until.getTime() - since.getTime(), 1);
    const prevMonthStart = startOfUtcMonth(
      new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() - 1, 1))
    );
    const previousSince = prevMonthStart;
    const previousUntil = new Date(previousSince.getTime() + durationMs);
    return {
      ok: true,
      windows: {
        since,
        until,
        previousSince,
        previousUntil,
        label: "This month",
        compareLabel: "vs last month",
        mode: input.mode,
      },
    };
  }

  if (input.mode === "custom") {
    const fromRaw = input.custom?.compareFrom?.trim() ?? "";
    const toRaw = input.custom?.compareTo?.trim() ?? "";
    if (!fromRaw || !toRaw) {
      // Incomplete custom selection: fall back to prior equal-length window so
      // the dashboard control can land on compare=custom without hard-failing.
      return resolveCompareWindows({ ...input, mode: "previous" });
    }
    const previousSince = parseBound(fromRaw);
    const previousUntilParsed = parseBound(toRaw);
    if (!previousSince || !previousUntilParsed) {
      return { ok: false, error: "Invalid compareFrom/compareTo date" };
    }
    const previousUntil = endOfDayUtcIfDateOnly(toRaw, previousUntilParsed);
    if (previousSince.getTime() > previousUntil.getTime()) {
      return { ok: false, error: "compareFrom must be before compareTo" };
    }
    const currentMs = Math.max(input.until.getTime() - input.since.getTime(), 1);
    const compareMs = Math.max(
      previousUntil.getTime() - previousSince.getTime(),
      1
    );
    if (!durationsEqual(currentMs, compareMs)) {
      return {
        ok: false,
        error: "Custom compare ranges must have equal duration",
      };
    }
    return {
      ok: true,
      windows: {
        since: input.since,
        until: input.until,
        previousSince,
        previousUntil,
        label: baseLabel,
        compareLabel: "vs custom period",
        mode: input.mode,
      },
    };
  }

  // Rolling: previous | week-ago
  const durationMs = Math.max(input.until.getTime() - input.since.getTime(), 1);
  const { previousSince, previousUntil } = resolveCompareWindow(
    durationMs,
    input.mode,
    input.since,
    input.until
  );
  const prevUntil = previousUntil ?? input.since;
  const compareLabel =
    input.mode === "week-ago" ? "vs same window last week" : "vs prior period";
  return {
    ok: true,
    windows: {
      since: input.since,
      until: input.until,
      previousSince,
      previousUntil: prevUntil,
      label: baseLabel,
      compareLabel,
      mode: input.mode,
    },
  };
}

/**
 * Equal-length prior window for a rolling compare mode.
 * `week-ago` shifts the whole window back 7 days; `previous` uses the
 * immediately preceding equal-length window.
 */
export function resolveCompareWindow(
  durationMs: number,
  compare: RollingCompareMode,
  currentSince: Date,
  currentUntil?: Date
): { previousSince: Date; previousUntil: Date | undefined } {
  const ms = durationMs;
  if (compare === "week-ago") {
    const windowEnd = currentUntil ?? new Date(currentSince.getTime() + ms);
    const weekAgoEnd = new Date(windowEnd.getTime() - WEEK_MS);
    const weekAgoStart = new Date(weekAgoEnd.getTime() - ms);
    return { previousSince: weekAgoStart, previousUntil: weekAgoEnd };
  }
  const previousSince = new Date(currentSince.getTime() - ms);
  return { previousSince, previousUntil: currentSince };
}

/**
 * Percentage change for absolute counts.
 * - previous ≤ 0 and current > 0 → "new" (never ÷0)
 * - previous ≤ 0 and current ≤ 0 → null (display "—")
 * - otherwise standard relative %
 */
export function percentChangeOrNew(
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
  const value = Math.round(((current - previous) / previous) * 10000) / 100;
  return { kind: "pct", value };
}

/** Legacy numeric helper: null means incomparable / New / 0→0. */
export function percentChange(current: number, previous: number): number | null {
  const result = percentChangeOrNew(current, previous);
  if (result.kind === "pct") return result.value;
  return null;
}

export function errorRatePpDelta(
  current: number | null,
  previous: number | null
): number | null {
  if (current == null || previous == null) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  return Math.round((current - previous) * 100) / 100;
}

export function compareLabelForMode(
  mode: CompareMode,
  rangeLabel: string
): string {
  switch (mode) {
    case "week-ago":
      return "vs same window last week";
    case "today-yesterday":
      return "vs yesterday";
    case "week":
      return "vs last week";
    case "month":
      return "vs last month";
    case "custom":
      return "vs custom period";
    default: {
      if (rangeLabel === "Recent data") return "vs earlier data";
      const normalized = rangeLabel.replace(/^Last /i, "");
      return `vs prior ${normalized.toLowerCase()}`;
    }
  }
}
