import { UNSELECTED_METRICS_FALLBACK_MS } from "./overview-metrics-window.js";

/**
 * Flexible time ranges for overview and list endpoints.
 * Supports presets (1h, 24h, 7d, …), custom relative (2h, 8w), and absolute from/to.
 */

export type TimeRangeBucket = "hour" | "day" | "week";

export type ParsedTimeRange = {
  /** Value stored in `range` query param (preset/custom token). */
  key: string;
  label: string;
  shortLabel: string;
  gte: Date;
  lte: Date;
  durationMs: number;
  bucket: TimeRangeBucket;
  bucketSeconds: number;
};

export const TIME_RANGE_PRESETS = [
  { key: "1h", label: "1 hour", shortLabel: "1H" },
  { key: "24h", label: "24 hours", shortLabel: "24H" },
  { key: "7d", label: "7 days", shortLabel: "7D" },
  { key: "14d", label: "14 days", shortLabel: "14D" },
  { key: "30d", label: "30 days", shortLabel: "30D" },
  { key: "90d", label: "90 days", shortLabel: "90D" },
] as const;

const PRESET_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "14d": 14 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

const MAX_RELATIVE_MS = 365 * 24 * 60 * 60 * 1000;

const CUSTOM_RELATIVE_RE = /^(\d+)(h|d|w|m)$/i;

function endOfDayUtc(iso: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Date(`${iso}T23:59:59.999Z`);
  }
  return new Date(iso);
}

function parseCustomRelativeMs(token: string): number | null {
  const m = token.trim().match(CUSTOM_RELATIVE_RE);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2]!.toLowerCase();
  const ms =
    unit === "h"
      ? n * 60 * 60 * 1000
      : unit === "d"
        ? n * 24 * 60 * 60 * 1000
        : unit === "w"
          ? n * 7 * 24 * 60 * 60 * 1000
          : n * 30 * 24 * 60 * 60 * 1000;
  if (ms > MAX_RELATIVE_MS) return null;
  return ms;
}

function formatCustomLabel(ms: number): string {
  const hours = ms / (60 * 60 * 1000);
  if (hours < 24) return `${Math.round(hours)} hours`;
  const days = hours / 24;
  return `${Math.round(days)} days`;
}

function formatCustomShort(ms: number): string {
  const hours = ms / (60 * 60 * 1000);
  if (hours < 24) return `${Math.round(hours)}H`;
  const days = hours / 24;
  if (days < 14) return `${Math.round(days)}D`;
  const weeks = days / 7;
  if (days % 7 === 0 && weeks < 52) return `${Math.round(weeks)}W`;
  return `${Math.round(days)}D`;
}

export function parseChartBucketParam(
  value: string | undefined
): TimeRangeBucket | undefined {
  const raw = value?.trim().toLowerCase();
  if (raw === "hour" || raw === "day" || raw === "week") return raw;
  return undefined;
}

/** Chart bucket from optional URL override, else auto-selected from window duration. */
export function resolveChartBucket(
  durationMs: number,
  override?: TimeRangeBucket
): TimeRangeBucket {
  return override ?? chooseTimeRangeBucket(durationMs).bucket;
}

export function chooseTimeRangeBucket(durationMs: number): {
  bucket: TimeRangeBucket;
  bucketSeconds: number;
} {
  const hours = durationMs / (60 * 60 * 1000);
  if (hours <= 48) {
    return { bucket: "hour", bucketSeconds: 3600 };
  }
  const days = hours / 24;
  if (days <= 90) {
    return { bucket: "day", bucketSeconds: 86_400 };
  }
  return { bucket: "week", bucketSeconds: 7 * 86_400 };
}

function buildParsed(
  key: string,
  label: string,
  shortLabel: string,
  gte: Date,
  lte: Date
): ParsedTimeRange {
  const durationMs = Math.max(0, lte.getTime() - gte.getTime());
  const { bucket, bucketSeconds } = chooseTimeRangeBucket(durationMs);
  return { key, label, shortLabel, gte, lte, durationMs, bucket, bucketSeconds };
}

export type ParseTimeRangeResult =
  | { ok: true; range: ParsedTimeRange }
  | { ok: false; error: string };

export function parseTimeRangeQuery(
  query: { range?: string; from?: string; to?: string },
  now: Date = new Date(),
  defaultKey = "24h"
): ParseTimeRangeResult {
  const fromRaw = query.from?.trim();
  const toRaw = query.to?.trim();

  if (fromRaw || toRaw) {
    const lte = toRaw ? endOfDayUtc(toRaw) : now;
    const gte = fromRaw ? new Date(fromRaw) : new Date(lte.getTime() - PRESET_MS["24h"]!);
    if (Number.isNaN(gte.getTime()) || Number.isNaN(lte.getTime())) {
      return { ok: false, error: "Invalid from/to date" };
    }
    if (gte.getTime() > lte.getTime()) {
      return { ok: false, error: "from must be before to" };
    }
    const durationMs = lte.getTime() - gte.getTime();
    if (durationMs > MAX_RELATIVE_MS) {
      return { ok: false, error: "Date range cannot exceed 365 days" };
    }
    const fromLabel = gte.toISOString().slice(0, 10);
    const toLabel = lte.toISOString().slice(0, 10);
    return {
      ok: true,
      range: buildParsed(
        "absolute",
        `${fromLabel} to ${toLabel}`,
        `${fromLabel.slice(5).replace("-", "/")}–${toLabel.slice(5).replace("-", "/")}`,
        gte,
        lte
      ),
    };
  }

  const raw = query.range?.trim() || defaultKey;
  const preset = TIME_RANGE_PRESETS.find((p) => p.key === raw);
  if (preset) {
    const ms = PRESET_MS[preset.key]!;
    const gte = new Date(now.getTime() - ms);
    return {
      ok: true,
      range: buildParsed(preset.key, preset.label, preset.shortLabel, gte, now),
    };
  }

  const customMs = parseCustomRelativeMs(raw);
  if (customMs !== null) {
    const gte = new Date(now.getTime() - customMs);
    return {
      ok: true,
      range: buildParsed(
        raw.toLowerCase(),
        formatCustomLabel(customMs),
        formatCustomShort(customMs),
        gte,
        now
      ),
    };
  }

  return { ok: false, error: `Invalid range: ${raw}` };
}

/** Normalize overview page range from URL (fallback to default on bad input). */
export function parseTimeRangeOrDefault(
  query: { range?: string; from?: string; to?: string },
  defaultKey = "24h"
): ParsedTimeRange {
  const parsed = parseTimeRangeQuery(query, new Date(), defaultKey);
  if (parsed.ok) return parsed.range;
  const fallback = parseTimeRangeQuery({ range: defaultKey }, new Date(), defaultKey);
  return fallback.ok
    ? fallback.range
    : buildParsed(
        "24h",
        "Last 24 hours",
        "24H",
        new Date(Date.now() - PRESET_MS["24h"]!),
        new Date()
      );
}

export function timeRangeSearchParams(range: ParsedTimeRange): Record<string, string> {
  if (range.key === "absolute") {
    return {
      from: range.gte.toISOString(),
      to: range.lte.toISOString(),
    };
  }
  return { range: range.key };
}

export function tryParseCustomRelativeInput(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  if (PRESET_MS[trimmed]) return trimmed;
  const ms = parseCustomRelativeMs(trimmed);
  return ms !== null ? trimmed : null;
}

export function isUnselectedTimeRange(key: string): boolean {
  return key === "none" || key === "all";
}

export function buildUnselectedTimeRange(now: Date = new Date()): ParsedTimeRange {
  return {
    key: "none",
    label: "Recent (charts: last 30 days)",
    shortLabel: "Recent · 30d charts",
    gte: new Date(0),
    lte: now,
    durationMs: now.getTime(),
    bucket: "week",
    bucketSeconds: 7 * 86_400,
  };
}

/** Duration for ingest-rate display when no time filter is selected (sync fallback). */
export function effectiveIngestRateDurationMs(range: ParsedTimeRange): number {
  if (!isUnselectedTimeRange(range.key)) {
    return Math.max(range.durationMs, 1);
  }
  return UNSELECTED_METRICS_FALLBACK_MS;
}

/** Metrics/compare window — unselected ranges use the recent chart span, not epoch→now. */
export function effectiveOverviewWindow(range: ParsedTimeRange): {
  gte: Date;
  lte: Date;
  durationMs: number;
} {
  if (!isUnselectedTimeRange(range.key)) {
    return {
      gte: range.gte,
      lte: range.lte,
      durationMs: Math.max(range.durationMs, 1),
    };
  }
  const durationMs = effectiveIngestRateDurationMs(range);
  return {
    gte: new Date(range.lte.getTime() - durationMs),
    lte: range.lte,
    durationMs,
  };
}

export function buildAllTimeRange(now: Date = new Date()): ParsedTimeRange {
  return buildUnselectedTimeRange(now);
}

export function parseOverviewTimeRangeQuery(
  query: { range?: string; from?: string; to?: string },
  now: Date = new Date()
): ParseTimeRangeResult {
  const hasFromTo = Boolean(query.from?.trim() || query.to?.trim());
  const rangeRaw = query.range?.trim();
  if (!hasFromTo && (!rangeRaw || rangeRaw === "all" || rangeRaw === "none")) {
    return { ok: true, range: buildUnselectedTimeRange(now) };
  }
  return parseTimeRangeQuery(query, now, "7d");
}

/**
 * List pages: default to `all` (events/errors) or a relative preset (sessions).
 */
export function parseListTimeRangeOrDefault(
  query: { range?: string; from?: string; to?: string },
  defaultKey: string = "all"
): ParsedTimeRange {
  const hasFromTo = Boolean(query.from?.trim() || query.to?.trim());
  const rangeRaw = query.range?.trim();

  if (!hasFromTo && !rangeRaw && defaultKey === "all") {
    return buildUnselectedTimeRange();
  }
  if (!hasFromTo && (rangeRaw === "all" || rangeRaw === "none")) {
    return buildUnselectedTimeRange();
  }

  const fallback = defaultKey === "all" ? "24h" : defaultKey;
  return parseTimeRangeOrDefault(query, fallback);
}

/** Hidden GET fields to preserve the active list time filter in filter forms. */
export function listTimeRangeHiddenFields(
  range: ParsedTimeRange,
  fromParam?: string,
  toParam?: string
): Record<string, string> {
  if (isUnselectedTimeRange(range.key)) return {};
  if (range.key === "absolute") {
    const from = fromParam?.trim() || range.gte.toISOString().slice(0, 10);
    const to = toParam?.trim() || range.lte.toISOString().slice(0, 10);
    return { from, to };
  }
  return { range: range.key };
}
