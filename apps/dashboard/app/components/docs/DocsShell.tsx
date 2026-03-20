"use client";

import { useCallback, useEffect, useState } from "react";
import { MenuIcon } from "@/app/components/sidebar/MenuIcon";
import { DocSidebar } from "./DocSidebar";

export function DocsShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, closeSidebar]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="docs-layout">
      <div
        className={`docs-sidebar-backdrop ${sidebarOpen ? "docs-sidebar-backdrop--visible" : ""}`}
        onClick={closeSidebar}
        aria-hidden
      />
      <DocSidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="docs-main-column">
        {!sidebarOpen ? (
          <button
            type="button"
            className="docs-mobile-menu-btn"
            onClick={openSidebar}
            aria-label="Open documentation menu"
          >
            <MenuIcon />
          </button>
        ) : null}
        <main className="main docs-main" id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
