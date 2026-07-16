"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DASHBOARD_GOTO_MAP, DASHBOARD_SHORTCUTS } from "@/lib/dashboard-shortcuts";
import { useDashboardNavigation } from "@/lib/use-dashboard-navigation";
import { ShellKbd } from "./DashboardPopover";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function DashboardKeyboardShortcuts() {
  const { push } = useDashboardNavigation();
  const [open, setOpen] = useState(false);
  const [awaitingGoto, setAwaitingGoto] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof DASHBOARD_SHORTCUTS>();
    for (const item of DASHBOARD_SHORTCUTS) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return map;
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    let gotoTimer: ReturnType<typeof setTimeout> | undefined;

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      if (awaitingGoto) {
        const href = DASHBOARD_GOTO_MAP[e.key.toLowerCase()];
        if (href) {
          e.preventDefault();
          setAwaitingGoto(false);
          if (gotoTimer) clearTimeout(gotoTimer);
          push(href);
        }
        return;
      }

      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setAwaitingGoto(true);
        if (gotoTimer) clearTimeout(gotoTimer);
        gotoTimer = setTimeout(() => setAwaitingGoto(false), 1500);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gotoTimer) clearTimeout(gotoTimer);
    };
  }, [awaitingGoto, close, open, push]);

  return (
    <>
      {awaitingGoto ? (
        <div
          className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full border border-border bg-popover px-4 py-2 text-[13px] text-muted-foreground shadow-lg"
          role="status"
        >
          Go to… <ShellKbd>O</ShellKbd> overview · <ShellKbd>I</ShellKbd> issues ·{" "}
          <ShellKbd>E</ShellKbd> events · <ShellKbd>S</ShellKbd> sessions
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            aria-hidden
            onPointerDown={close}
          />
          <div
            className="relative w-full max-w-md overflow-hidden rounded-xl border border-border bg-popover shadow-2xl shadow-black/60"
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-medium">Keyboard shortcuts</h2>
              <ShellKbd>Esc</ShellKbd>
            </div>
            <div className="max-h-[min(60vh,420px)] overflow-y-auto p-4">
              {Array.from(grouped.entries()).map(([group, items]) => (
                <div key={group} className="mb-4 last:mb-0">
                  <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {group}
                  </p>
                  <ul className="divide-y divide-border">
                    {items.map((item) => (
                      <li key={item.label} className="flex items-center justify-between gap-4 py-2.5">
                        <span className="text-[13px]">{item.label}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {item.keys.map((k) => (
                            <ShellKbd key={k}>{k}</ShellKbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="border-t border-border px-4 py-3 text-[12px] text-muted-foreground">
              <Link href="/dashboard/settings/shortcuts" onClick={close} className="hover:text-foreground">
                All shortcuts in settings →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
