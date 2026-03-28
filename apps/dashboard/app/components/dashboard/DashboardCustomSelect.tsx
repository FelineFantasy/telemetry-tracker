"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type DashboardSelectOption = {
  value: string;
  label: string;
};

/**
 * Same UX as errors filters: list opens **below** the field, spaced chevron, theme styling.
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
    <div className="errors-filters__select-wrap" ref={wrapRef}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        type="button"
        id={triggerId}
        className="errors-filters__select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
        aria-controls={open ? listId : undefined}
        aria-labelledby={listLabelledBy}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="errors-filters__select-value">{selected?.label ?? ""}</span>
        <span className="errors-filters__select-chevron" aria-hidden>
          <ChevronDownIcon />
        </span>
      </button>
      {open ? (
        <ul
          id={listId}
          className="errors-filters__select-list"
          role="listbox"
          aria-labelledby={listLabelledBy}
        >
          {options.map((opt) => (
            <li key={opt.value === "" ? "__empty" : opt.value} role="none">
              <button
                type="button"
                role="option"
                aria-selected={opt.value === value ? "true" : "false"}
                className="errors-filters__select-option"
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
