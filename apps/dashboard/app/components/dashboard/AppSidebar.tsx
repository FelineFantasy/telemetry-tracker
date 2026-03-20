"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SidebarBrand } from "@/app/components/sidebar/SidebarBrand";
import { useMobileDrawer } from "@/lib/useMobileDrawer";
import { DashboardViewLinks } from "./DashboardViewLinks";
import { SidebarLink } from "./SidebarLink";

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
  const isMobileDrawer = useMobileDrawer();

  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

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
      <SidebarBrand
        onNavigate={handleNav}
        onClose={onClose}
        showDrawerClose={isMobileDrawer}
        closeAriaLabel="Close application menu"
      />

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
      </div>

      <div className="app-sidebar__body">
        <nav className="app-sidebar__nav" aria-label="Select application">
          <SidebarLink
            href={buildHref(pathForLinks, null, searchParams)}
            label="All apps"
            mono="∞"
            current={!currentApp}
            onNavigate={handleNav}
            title="All apps"
          />
          {apps.map((app) => (
            <SidebarLink
              key={app}
              href={buildHref(pathForLinks, app, searchParams)}
              label={app}
              mono={appMonogram(app)}
              current={currentApp === app}
              onNavigate={handleNav}
              title={app}
            />
          ))}
        </nav>
      </div>

      <div className="app-sidebar__rail-footer">
        <nav className="app-sidebar__footer" aria-label="Other">
          <SidebarLink
            href="/docs"
            label="Docs"
            mono="D"
            onNavigate={handleNav}
            title="Documentation"
            className="app-sidebar__link--footer"
          />
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
