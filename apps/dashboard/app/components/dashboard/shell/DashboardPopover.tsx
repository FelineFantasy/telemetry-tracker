"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export function useOutsideClick(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);
  return ref;
}

export function DashboardPopover({
  trigger,
  align = "left",
  width = "w-72",
  children,
}: {
  trigger: (toggle: () => void, open: boolean) => ReactNode;
  align?: "left" | "right";
  width?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useOutsideClick(open, close);

  return (
    <div className="relative" ref={ref}>
      {trigger(() => setOpen((v) => !v), open)}
      {open ? (
        <div
          className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full z-50 mt-2 ${width} overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-black/60`}
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}

export function ShellKbd({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-border bg-background px-1 py-px font-mono text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}
