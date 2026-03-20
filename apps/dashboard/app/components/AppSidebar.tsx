"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import { DashboardViewLinks } from "./DashboardViewLinks";

const DASHBOARD_BASE = "/dashboard";

function buildHref(path: string, app: string | null, otherParams: URLSearchParams): string {
  const params = new URLSearchParams(otherParams);
  if (app) params.set("app", app);
  else params.delete("app");
  const q = params.toString();
  const base = path || `${DASHBOARD_BASE}/overview`;
  return q ? `${base}?${q}` : base;
}

function sidebarPath(pathname: string): string {
  if (pathname === "/dashboard" || pathname === "/dashboard/") return `${DASHBOARD_BASE}/overview`;
  return pathname?.startsWith(DASHBOARD_BASE) ? pathname : `${DASHBOARD_BASE}/overview`;
}

function appMonogram(app: string): string {
  const t = app.trim();
  if (t.length <= 2) return t.toUpperCase();
  return t.slice(0, 2).toUpperCase();
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronCollapseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 6l-6 6 6 6"
      />
    </svg>
  );
}

function ChevronExpandIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 6l6 6-6 6"
      />
    </svg>
  );
}

export function AppSidebar({
  apps,
  isOpen = false,
  onClose,
  desktopCollapsed = false,
  onToggleDesktopCollapse,
}: {
  apps: string[];
  isOpen?: boolean;
  onClose?: () => void;
  desktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
}) {
  const pathname = usePathname() ?? "/";
  const pathForLinks = sidebarPath(pathname);
  const searchParams = useSearchParams();
  const currentApp = searchParams.get("app") ?? "";

  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const [isMobileDrawer, setIsMobileDrawer] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobileDrawer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (!isDashboard) return null;

  const handleNav = () => {
    onClose?.();
  };

  const inertOffCanvas = isMobileDrawer && !isOpen;
  const compactDesktop = !isMobileDrawer && desktopCollapsed;

  const asideClass = [
    "app-sidebar",
    isOpen ? "app-sidebar--open" : "",
    compactDesktop ? "app-sidebar--desktop-collapsed" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={asideClass} aria-label="Dashboard" inert={inertOffCanvas ? true : undefined}>
      <div className="app-sidebar__brand">
        <Link
          href="/"
          className="app-sidebar__brand-link"
          onClick={handleNav}
          title="Telemetry Tracker — Home"
        >
          <span className="app-sidebar__brand-full">Telemetry Tracker</span>
          <span className="app-sidebar__brand-short" aria-hidden>
            T
          </span>
        </Link>
      </div>

      <div className="app-sidebar__section app-sidebar__section--views">
        <div className="app-sidebar__head">
          <h2 className="app-sidebar__title">
            <span className="app-sidebar__title-full">Views</span>
            <span className="app-sidebar__title-short" aria-hidden>
              V
            </span>
          </h2>
        </div>
        <nav className="app-sidebar__nav" aria-label="Telemetry views">
          <DashboardViewLinks onNavigate={handleNav} />
        </nav>
      </div>

      <div className="app-sidebar__head">
        <h2 className="app-sidebar__title">
          <span className="app-sidebar__title-full">App</span>
          <span className="app-sidebar__title-short" aria-hidden>
            A
          </span>
        </h2>
        {isMobileDrawer ? (
          <button
            type="button"
            className="app-sidebar__close"
            onClick={onClose}
            aria-label="Close application menu"
          >
            <CloseIcon />
          </button>
        ) : null}
      </div>

      <div className="app-sidebar__body">
        <nav className="app-sidebar__nav" aria-label="Select application">
          <Link
            href={buildHref(pathForLinks, null, searchParams)}
            className="app-sidebar__link"
            aria-current={!currentApp ? "page" : undefined}
            onClick={handleNav}
            title="All apps"
          >
            <span className="app-sidebar__link-mono" aria-hidden>
              ∞
            </span>
            <span className="app-sidebar__link-label">All apps</span>
          </Link>
          {apps.map((app) => (
            <Link
              key={app}
              href={buildHref(pathForLinks, app, searchParams)}
              className="app-sidebar__link"
              aria-current={currentApp === app ? "page" : undefined}
              onClick={handleNav}
              title={app}
            >
              <span className="app-sidebar__link-mono" aria-hidden>
                {appMonogram(app)}
              </span>
              <span className="app-sidebar__link-label">{app}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="app-sidebar__rail-footer">
        <nav className="app-sidebar__footer" aria-label="Other">
          <Link
            href="/docs"
            className="app-sidebar__link app-sidebar__link--footer"
            onClick={handleNav}
            title="Documentation"
          >
            <span className="app-sidebar__link-mono" aria-hidden>
              D
            </span>
            <span className="app-sidebar__link-label">Docs</span>
          </Link>
        </nav>
      </div>

      {!isMobileDrawer ? (
        <button
          type="button"
          className="app-sidebar__desktop-toggle"
          onClick={onToggleDesktopCollapse}
          aria-expanded={!desktopCollapsed}
          aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {desktopCollapsed ? <ChevronExpandIcon /> : <ChevronCollapseIcon />}
        </button>
      ) : null}
    </aside>
  );
}
