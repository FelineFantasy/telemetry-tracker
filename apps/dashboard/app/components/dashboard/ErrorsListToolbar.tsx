"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DashboardCustomSelect } from "@/app/components/dashboard/DashboardCustomSelect";
import type { DashboardSelectOption } from "@/app/components/dashboard/DashboardCustomSelect";
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

type Props = {
  path: string;
  currentParams: Record<string, string>;
  activePreset: string;
  customRange: boolean;
  /** Current `range` query value when using presets (omit when empty). */
  rangePreset: string;
  appFilter: string;
  pageSize: string;
  defaultPageSize: number;
  from: string;
  to: string;
  q: string;
  environment: string;
  status: string;
  sort: string;
  order: string;
  trendWindow: string;
  environments: string[];
};

export function ErrorsListToolbar({
  path,
  currentParams,
  activePreset,
  customRange,
  rangePreset,
  appFilter,
  pageSize,
  defaultPageSize,
  from,
  to,
  q,
  environment,
  status,
  sort,
  order,
  trendWindow,
  environments,
}: Props) {
  const router = useRouter();
  const panelId = useId();
  const fieldIds = useId();
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

  const rangeSummary =
    customRange && (from || to)
      ? `${formatDayLabel(from)} — ${formatDayLabel(to)}`
      : null;

  const sortOptions: DashboardSelectOption[] = useMemo(
    () => [
      { value: "last_seen", label: "Last seen" },
      { value: "first_seen", label: "First seen" },
      { value: "occurrences", label: "Occurrences" },
      { value: "message", label: "Message" },
      { value: "app", label: "App" },
      { value: "environment", label: "Environment" },
      { value: "users", label: "Users affected" },
      { value: "sessions", label: "Sessions" },
      { value: "trend", label: "Trend" },
    ],
    []
  );

  const environmentOptions: DashboardSelectOption[] = useMemo(
    () => [
      { value: "", label: "Any" },
      ...environments.map((e) => ({ value: e, label: e })),
    ],
    [environments]
  );

  const statusOptions: DashboardSelectOption[] = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "unresolved", label: "Open" },
      { value: "resolved", label: "Resolved" },
    ],
    []
  );

  const id = (suffix: string) => `${fieldIds.replace(/:/g, "")}-${suffix}`;

  return (
    <div className="errors-filters" aria-labelledby={panelId}>
      <div className="errors-filters__header">
        <h2 id={panelId} className="errors-filters__title">
          Filters &amp; sort
        </h2>
        {rangeSummary ? (
          <span className="errors-filters__range-badge" title="Custom date range">
            {rangeSummary}
          </span>
        ) : null}
      </div>

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
                    {/* Sibling under popover: catches outside clicks without relying on ref timing / contains() */}
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

      <form method="get" action={path} className="errors-filters__form">
        {appFilter ? <input type="hidden" name="app" value={appFilter} /> : null}
        {rangePreset && !customRange ? (
          <input type="hidden" name="range" value={rangePreset} />
        ) : null}
        {customRange && from ? <input type="hidden" name="from" value={from} /> : null}
        {customRange && to ? <input type="hidden" name="to" value={to} /> : null}
        {Number(pageSize) !== defaultPageSize ? (
          <input type="hidden" name="pageSize" value={pageSize} />
        ) : null}

        <div className="errors-filters__row errors-filters__row--search">
          <label className="errors-filters__field errors-filters__field--grow">
            <span className="errors-filters__label">Search message</span>
            <input
              type="search"
              name="q"
              className="errors-filters__input errors-filters__input--search"
              defaultValue={q}
              placeholder="Filter by error text…"
              autoComplete="off"
            />
          </label>
          <label className="errors-filters__field">
            <span className="errors-filters__label" id={id("env-l")}>
              Environment
            </span>
            <DashboardCustomSelect
              name="environment"
              value={environment}
              options={environmentOptions}
              triggerId={id("env-t")}
              listLabelledBy={id("env-l")}
            />
          </label>
          <label className="errors-filters__field">
            <span className="errors-filters__label" id={id("status-l")}>
              Status
            </span>
            <DashboardCustomSelect
              name="status"
              value={status || "all"}
              options={statusOptions}
              triggerId={id("status-t")}
              listLabelledBy={id("status-l")}
            />
          </label>
        </div>

        <div className="errors-filters__row errors-filters__row--sort">
          <label className="errors-filters__field">
            <span className="errors-filters__label" id={id("sort-l")}>
              Sort by
            </span>
            <DashboardCustomSelect
              name="sort"
              value={sort || "last_seen"}
              options={sortOptions}
              triggerId={id("sort-t")}
              listLabelledBy={id("sort-l")}
            />
          </label>

          <fieldset
            className="errors-filters__fieldset"
            title="Descending: newest dates and largest counts first. Ascending: the opposite."
          >
            <legend className="errors-filters__label">Order</legend>
            <div className="errors-filters__segment" role="group" aria-label="Sort order">
              <label className="errors-filters__segment-item">
                <input type="radio" name="order" value="desc" defaultChecked={order !== "asc"} />
                <span>Desc</span>
              </label>
              <label className="errors-filters__segment-item">
                <input type="radio" name="order" value="asc" defaultChecked={order === "asc"} />
                <span>Asc</span>
              </label>
            </div>
          </fieldset>

          <fieldset className="errors-filters__fieldset">
            <legend className="errors-filters__label">Trend window</legend>
            <div className="errors-filters__segment" role="group" aria-label="Trend comparison window">
              <label className="errors-filters__segment-item">
                <input type="radio" name="trendWindow" value="24h" defaultChecked={trendWindow !== "7d"} />
                <span>24h</span>
              </label>
              <label className="errors-filters__segment-item">
                <input type="radio" name="trendWindow" value="7d" defaultChecked={trendWindow === "7d"} />
                <span>7d</span>
              </label>
            </div>
          </fieldset>

          <div className="errors-filters__submit-wrap">
            <button type="submit" className="errors-filters__btn errors-filters__btn--primary errors-filters__btn--submit">
              Apply
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
