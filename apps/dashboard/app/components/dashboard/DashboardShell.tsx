"use client";

import { useCallback, useEffect, useState } from "react";
import { MenuIcon } from "@/app/components/sidebar/MenuIcon";
import { AppSidebar } from "./AppSidebar";
import { DashboardAppContext } from "./DashboardAppContext";

const SIDEBAR_COLLAPSED_KEY = "telemetry-dashboard-sidebar-collapsed";

export function DashboardShell({
  apps,
  children,
}: {
  apps: string[];
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") {
        setDesktopCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);

  const toggleDesktopSidebar = useCallback(() => {
    setDesktopCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

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
    <div className="dashboard-layout">
      <div
        className={`dashboard-sidebar-backdrop ${sidebarOpen ? "dashboard-sidebar-backdrop--visible" : ""}`}
        onClick={closeSidebar}
        aria-hidden
      />
      <AppSidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        desktopCollapsed={desktopCollapsed}
        onToggleDesktopCollapse={toggleDesktopSidebar}
      />
      <div className="dashboard-right">
        {!sidebarOpen ? (
          <button
            type="button"
            className="dashboard-mobile-menu-btn"
            onClick={openSidebar}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
        ) : null}
        <main className="main" id="main-content">
          <DashboardAppContext apps={apps} />
          {children}
        </main>
      </div>
    </div>
  );
}
