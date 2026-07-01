"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, Search } from "lucide-react";
import { NavPickerTrigger } from "@/app/components/dashboard/shell/shell-primitives";
import { mergeListQuery } from "@/lib/list-filters-url";
import { inputFieldClassName, searchInputClassName } from "@/lib/input-classes";
import { cn } from "@/lib/utils";
import {
  TIME_RANGE_PRESETS,
  isUnselectedTimeRange,
  tryParseCustomRelativeInput,
  type ParsedTimeRange,
  type TimeRangeQueryKeys,
  DEFAULT_TIME_RANGE_QUERY_KEYS,
} from "@/lib/time-range";

type Props = {
  path: string;
  currentParams: Record<string, string>;
  range: Pick<ParsedTimeRange, "key" | "label" | "shortLabel"> & {
    gte: string;
    lte: string;
  };
  /** Show "No date filter" — events, issues, sessions lists. */
  includeAll?: boolean;
  queryKeys?: TimeRangeQueryKeys;
  compact?: boolean;
};

function isoToDateInput(iso: string): string {
  if (!iso || iso.startsWith("1970")) {
    return new Date().toISOString().slice(0, 10);
  }
  return iso.slice(0, 10);
}

function optionClass(selected: boolean): string {
  return selected
    ? "bg-muted text-foreground"
    : "text-foreground hover:bg-surface/80";
}

export function TimeRangePicker({
  path,
  currentParams,
  range,
  includeAll = false,
  queryKeys = DEFAULT_TIME_RANGE_QUERY_KEYS,
  compact = false,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [showAbsolute, setShowAbsolute] = useState(false);
  const [fromDate, setFromDate] = useState(isoToDateInput(range.gte));
  const [toDate, setToDate] = useState(isoToDateInput(range.lte));

  const { range: rangeKey, from: fromKey, to: toKey } = queryKeys;

  const close = useCallback(() => {
    setOpen(false);
    setShowAbsolute(false);
  }, []);

  const navigate = useCallback(
    (updates: Record<string, string | null>) => {
      router.push(
        mergeListQuery(path, currentParams, {
          ...updates,
          page: null,
          errorsPage: null,
          eventsPage: null,
        })
      );
    },
    [currentParams, path, router]
  );

  const applyPreset = useCallback(
    (key: string) => {
      navigate({ [rangeKey]: key, [fromKey]: null, [toKey]: null });
    },
    [fromKey, navigate, rangeKey, toKey]
  );

  const clearDateFilter = useCallback(() => {
    navigate({ [rangeKey]: null, [fromKey]: null, [toKey]: null });
  }, [fromKey, navigate, rangeKey, toKey]);

  const applyCustom = useCallback(
    (raw: string) => {
      const token = tryParseCustomRelativeInput(raw);
      if (!token) return false;
      navigate({ [rangeKey]: token, [fromKey]: null, [toKey]: null });
      return true;
    },
    [fromKey, navigate, rangeKey, toKey]
  );

  const applyAbsolute = useCallback(() => {
    if (!fromDate || !toDate) return;
    navigate({
      [rangeKey]: null,
      [fromKey]: fromDate,
      [toKey]: toDate,
    });
  }, [fromDate, fromKey, navigate, rangeKey, toDate, toKey]);

  const onCustomKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (applyCustom(customInput)) {
      setCustomInput("");
    }
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      close();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  const isAbsolute = range.key === "absolute";
  const isUnselected = isUnselectedTimeRange(range.key);
  const customActive =
    !isAbsolute &&
    !isUnselected &&
    !TIME_RANGE_PRESETS.some((p) => p.key === range.key);

  const triggerLabel = isUnselected ? "Time range" : range.shortLabel;

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <NavPickerTrigger
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Filter time range"
        className={cn(
          compact
            ? "max-w-none font-mono text-[11px] uppercase tracking-wide"
            : "max-w-none font-mono text-xs uppercase tracking-wide",
          open && "border-border-strong bg-surface"
        )}
      >
        <span className={isUnselected ? "text-muted-foreground" : undefined}>
          {triggerLabel}
        </span>
        <ChevronDown
          className={`ml-1 h-3 w-3 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </NavPickerTrigger>

      {open ? (
        <div
          role="dialog"
          aria-label="Filter by date"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[200] w-72 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-black/60"
        >
          <div className="py-1">
            <p className="px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Filter by date
            </p>
            <p className="px-3 pb-2 text-[11px] text-muted-foreground">
              Leave unselected to show the latest rows regardless of age.
            </p>

            <div className="mx-2 mb-2 flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 focus-within:border-border-strong">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={onCustomKeyDown}
                placeholder="Custom: 2h, 4d, 8w…"
                className={cn(searchInputClassName, "w-full py-0.5 text-sm")}
              />
            </div>

            <ul className="px-1">
              {includeAll ? (
                <li>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${optionClass(isUnselected)}`}
                    onClick={() => {
                      clearDateFilter();
                      close();
                    }}
                  >
                    <Check
                      className={`h-3.5 w-3.5 shrink-0 ${isUnselected ? "opacity-100" : "opacity-0"}`}
                      aria-hidden
                    />
                    No date filter
                  </button>
                </li>
              ) : null}

              {TIME_RANGE_PRESETS.map((preset) => {
                const selected = !isAbsolute && !isUnselected && range.key === preset.key;
                return (
                  <li key={preset.key}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${optionClass(selected)}`}
                      onClick={() => {
                        applyPreset(preset.key);
                        close();
                      }}
                    >
                      <Check
                        className={`h-3.5 w-3.5 shrink-0 ${
                          selected ? "opacity-100" : "opacity-0"
                        }`}
                        aria-hidden
                      />
                      {preset.label}
                    </button>
                  </li>
                );
              })}

              {customActive ? (
                <li>
                  <div className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${optionClass(true)}`}>
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {range.label}
                  </div>
                </li>
              ) : null}
            </ul>

            <div className="mt-1 border-t border-border px-1 pt-1">
              {!showAbsolute ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-surface/80"
                  onClick={() => {
                    setFromDate(isoToDateInput(range.gte));
                    setToDate(isoToDateInput(range.lte));
                    setShowAbsolute(true);
                  }}
                >
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className={isAbsolute ? "font-medium text-foreground" : undefined}>
                    Absolute date
                  </span>
                  {isAbsolute ? (
                    <Check className="ml-auto h-3.5 w-3.5 shrink-0" aria-hidden />
                  ) : null}
                </button>
              ) : (
                <div className="space-y-2 px-2 py-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Absolute date range</p>
                  <label className="block text-xs text-muted-foreground">
                    From
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className={cn(inputFieldClassName, "date-input mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-border-strong")}
                    />
                  </label>
                  <label className="block text-xs text-muted-foreground">
                    To
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className={cn(inputFieldClassName, "date-input mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-border-strong")}
                    />
                  </label>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      className="flex-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-surface/80"
                      onClick={() => setShowAbsolute(false)}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="flex-1 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground hover:bg-surface/80"
                      onClick={() => {
                        applyAbsolute();
                        close();
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
