"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type PanelPosition = { top: number; left: number; minWidth: number };

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
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setOpen((current) => {
      const next = !current;
      if (next && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 8,
          left: align === "right" ? rect.right : rect.left,
          minWidth: rect.width,
        });
      }
      return next;
    });
  }, [align]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
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

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: align === "right" ? rect.right : rect.left,
        minWidth: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [align, open]);

  const panel =
    open && position && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            className={`fixed z-[1000] ${width} overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-black/60`}
            style={{
              top: position.top,
              left: align === "right" ? undefined : position.left,
              right:
                align === "right"
                  ? Math.max(8, window.innerWidth - position.left)
                  : undefined,
              minWidth: position.minWidth,
            }}
          >
            {children(close)}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div ref={triggerRef} className="relative shrink-0">
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
