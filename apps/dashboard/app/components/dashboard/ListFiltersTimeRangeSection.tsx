"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type DateRange, DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { mergeListQuery } from "@/lib/list-filters-url";
import { DATE_RANGE_PRESETS } from "@/lib/date-range-presets";

import "react-day-picker/style.css";

function parseDateParam(s: string | undefined): Date | undefined {
  if (!s?.trim()) return undefined;
  try {
    const d = parseISO(s.trim());
    return Number.isNaN(d.getTime()) ? undefined : d;
  } catch {
    return undefined;
  }
}

function formatDayLabel(s: string | undefined): string {
  const d = parseDateParam(s);
  return d ? format(d, "MMM d, yyyy") : "…";
}

export function ListFiltersTimeRangeSection({
  path,
  currentParams,
  activePreset,
  customRange,
  from,
  to,
}: {
  path: string;
  currentParams: Record<string, string>;
  activePreset: string;
  customRange: boolean;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [useTwoMonths, setUseTwoMonths] = useState(false);
  const [popoverBox, setPopoverBox] = useState({ top: 0, left: 0, width: 360 });
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(() => {
    const a = parseDateParam(from);
    const b = parseDateParam(to);
    if (a && b) return { from: a, to: b };
    if (a) return { from: a, to: a };
    return undefined;
  });

  useEffect(() => {
    const a = parseDateParam(from);
    const b = parseDateParam(to);
    if (a && b) setDraftRange({ from: a, to: b });
    else if (a) setDraftRange({ from: a, to: a });
    else setDraftRange(undefined);
  }, [from, to]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 720px)");
    const fn = () => setUseTwoMonths(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const updatePopoverPosition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const margin = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(640, vw - 2 * margin);
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, vw - width - margin));
    let top = rect.bottom + 8;
    const maxPopoverH = Math.min(vh * 0.88, 640);
    if (top + maxPopoverH > vh - margin) {
      top = Math.max(margin, rect.top - maxPopoverH - 8);
    }
    setPopoverBox({ top, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!rangeOpen) return;
    updatePopoverPosition();
    const btn = triggerRef.current;
    const ro = btn ? new ResizeObserver(() => updatePopoverPosition()) : null;
    if (btn && ro) ro.observe(btn);
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [rangeOpen, updatePopoverPosition, useTwoMonths]);

  useEffect(() => {
    if (!rangeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRangeOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [rangeOpen]);

  const applyCustomRange = useCallback(() => {
    if (!draftRange?.from) return;
    const fromStr = format(draftRange.from, "yyyy-MM-dd");
    const end = draftRange.to ?? draftRange.from;
    const toStr = format(end, "yyyy-MM-dd");
    const href = mergeListQuery(path, currentParams, {
      from: fromStr,
      to: toStr,
      range: null,
      page: null,
    });
    router.push(href);
    setRangeOpen(false);
  }, [draftRange, path, currentParams, router]);

  const clearCustomRange = useCallback(() => {
    const href = mergeListQuery(path, currentParams, {
      from: null,
      to: null,
      page: null,
    });
    router.push(href);
    setRangeOpen(false);
  }, [path, currentParams, router]);

  return (
    <div className="errors-filters__section">
      <span className="errors-filters__section-label">Time range</span>
      <div className="errors-filters__presets">
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
              className={`errors-filters__pill${isCurrent ? " errors-filters__pill--active" : ""}`}
            >
              {label}
            </Link>
          );
        })}
        <div className="errors-filters__calendar-wrap">
          <button
            ref={triggerRef}
            type="button"
            className={`errors-filters__pill errors-filters__pill--trigger${customRange ? " errors-filters__pill--active" : ""}`}
            onClick={() => setRangeOpen((o) => !o)}
            aria-expanded={rangeOpen ? "true" : "false"}
            aria-haspopup="dialog"
          >
            Calendar
          </button>
          {rangeOpen
            ? createPortal(
                <>
                  <div
                    className="errors-filters__date-backdrop"
                    aria-hidden
                    onPointerDown={() => setRangeOpen(false)}
                  />
                  <div
                    className="errors-filters__popover"
                    role="dialog"
                    aria-label="Choose date range"
                    style={{
                      position: "fixed",
                      top: popoverBox.top,
                      left: popoverBox.left,
                      width: popoverBox.width,
                      maxHeight: "min(88vh, 640px)",
                      overflowY: "auto",
                      zIndex: 200,
                    }}
                  >
                    <p className="errors-filters__popover-hint">
                      Select a start date, then an end date. One day is OK.
                    </p>
                    <DayPicker
                      mode="range"
                      defaultMonth={draftRange?.from ?? new Date()}
                      selected={draftRange}
                      onSelect={setDraftRange}
                      numberOfMonths={useTwoMonths ? 2 : 1}
                      className="errors-filters__day-picker"
                    />
                    <div className="errors-filters__popover-actions">
                      <button
                        type="button"
                        className="errors-filters__btn errors-filters__btn--ghost"
                        onClick={clearCustomRange}
                      >
                        Clear dates
                      </button>
                      <button
                        type="button"
                        className="errors-filters__btn errors-filters__btn--primary"
                        onClick={applyCustomRange}
                        disabled={!draftRange?.from}
                      >
                        Apply range
                      </button>
                    </div>
                  </div>
                </>,
                document.body
              )
            : null}
        </div>
      </div>
    </div>
  );
}

export function listFiltersRangeSummary(
  customRange: boolean,
  from: string,
  to: string
): string | null {
  return customRange && (from || to)
    ? `${formatDayLabel(from)} — ${formatDayLabel(to)}`
    : null;
}
