"use client";

import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  type Placement,
} from "@floating-ui/react-dom";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useDashboardNavigation } from "@/lib/use-dashboard-navigation";
import { cn } from "@/lib/utils";

export function DashboardPopover({
  trigger,
  align = "left",
  width = "w-72",
  children,
  onOpenChange,
}: {
  trigger: (toggle: () => void, open: boolean) => ReactNode;
  align?: "left" | "right";
  width?: string;
  children: (close: () => void) => ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const { isPending } = useDashboardNavigation();
  const [open, setOpen] = useState(false);
  const placement: Placement = align === "right" ? "bottom-end" : "bottom-start";

  const { refs, floatingStyles } = useFloating({
    open,
    placement,
    strategy: "fixed",
    middleware: [offset(8), flip({ padding: 16 }), shift({ padding: 16 })],
    whileElementsMounted: autoUpdate,
  });

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    if (isPending) return;
    setOpen((current) => !current);
  }, [isPending]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (isPending && open) close();
  }, [close, isPending, open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const reference = refs.reference.current;
      if (reference instanceof Node && reference.contains(target)) return;
      if (refs.floating.current?.contains(target)) return;
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
  }, [close, open, refs.reference, refs.floating]);

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={refs.setFloating}
            className={cn(
              "z-[9999] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-black/60",
              width
            )}
            style={floatingStyles}
          >
            {children(close)}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div ref={refs.setReference} className="relative inline-flex shrink-0">
        {trigger(toggle, open)}
      </div>
      {panel}
    </>
  );
}

export function ShellKbd({ children }: { children: ReactNode }) {
  return (
    <span className="rounded border border-border bg-background px-1 py-px font-mono text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}
