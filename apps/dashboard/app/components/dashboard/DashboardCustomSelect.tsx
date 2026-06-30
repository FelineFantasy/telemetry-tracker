"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type DashboardSelectOption = {
  value: string;
  label: string;
};

/**
 * Custom select aligned with list filter fields — opens below the trigger.
 * - **Form**: pass `name` — renders `<input type="hidden" />` for GET/POST.
 * - **Navigation**: pass `onValueChange` — e.g. app scope `router.push` (no `name`).
 */
export function DashboardCustomSelect({
  name,
  value: valueProp,
  options,
  triggerId,
  listLabelledBy,
  onValueChange,
}: {
  name?: string;
  value: string;
  options: DashboardSelectOption[];
  triggerId: string;
  listLabelledBy: string;
  onValueChange?: (value: string) => void;
}) {
  const listId = `${triggerId}-listbox`;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(valueProp);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(valueProp);
  }, [valueProp]);

  useLayoutEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? options[0];

  function pick(next: string) {
    setValue(next);
    setOpen(false);
    onValueChange?.(next);
  }

  return (
    <div className="relative min-w-[8rem]" ref={wrapRef}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        type="button"
        id={triggerId}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 text-left text-[13px]",
          "hover:border-muted-foreground/30 focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand/30"
        )}
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
        aria-controls={open ? listId : undefined}
        aria-labelledby={listLabelledBy}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="truncate text-foreground">{selected?.label ?? ""}</span>
        <span className="shrink-0 text-muted-foreground" aria-hidden>
          <ChevronDownIcon />
        </span>
      </button>
      {open ? (
        <ul
          id={listId}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-60 overflow-auto rounded-md border border-border bg-popover py-1 shadow-lg"
          role="listbox"
          aria-labelledby={listLabelledBy}
        >
          {options.map((opt) => (
            <li key={opt.value === "" ? "__empty" : opt.value} role="none">
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value ? "true" : "false"}
                className={cn(
                  "flex w-full px-3 py-2 text-left text-[13px] transition-colors",
                  opt.value === value
                    ? "bg-brand/10 text-foreground"
                    : "text-muted-foreground hover:bg-surface/60 hover:text-foreground"
                )}
                onClick={() => pick(opt.value)}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
