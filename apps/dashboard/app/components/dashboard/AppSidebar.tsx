"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarBrand } from "@/app/components/sidebar/SidebarBrand";
import { useMobileDrawer } from "@/lib/useMobileDrawer";
import { OrgSwitcher, type OrgOption } from "./OrgSwitcher";
import { ProjectSwitcher, type ProjectOption } from "./ProjectSwitcher";
import { DashboardViewLinks } from "./DashboardViewLinks";
import { LogoutForm } from "./LogoutForm";
import { SidebarLink } from "./SidebarLink";
import { DocsNavIcon } from "./sidebarNavIcons";
import type { DashboardUser } from "@/lib/dashboard-user";

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
  isOpen = false,
  onClose,
  desktopCollapsed = false,
  onToggleDesktopCollapse,
  organizations = [],
  currentOrganizationId = null,
  projects = [],
  currentProjectId = "",
  user = null,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  desktopCollapsed?: boolean;
  onToggleDesktopCollapse?: () => void;
  organizations?: OrgOption[];
  currentOrganizationId?: string | null;
  projects?: ProjectOption[];
  currentProjectId?: string;
  user?: DashboardUser | null;
}) {
  const pathname = usePathname() ?? "/";
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

      {organizations.length > 0 && currentOrganizationId ? (
        <div className="app-sidebar__project">
          <OrgSwitcher
            organizations={organizations}
            currentOrganizationId={currentOrganizationId}
          />
        </div>
      ) : null}

      {projects.length > 0 && currentProjectId ? (
        <div className="app-sidebar__project">
          <ProjectSwitcher projects={projects} currentProjectId={currentProjectId} />
        </div>
      ) : organizations.length > 0 ? (
        <div className="app-sidebar__project">
          <p className="project-switcher project-switcher--single text-muted-foreground text-sm m-0">
            No projects in this organization.{" "}
            <Link href="/dashboard/settings/organization" className="underline">
              Create one
            </Link>
            .
          </p>
        </div>
      ) : null}

      <nav className="app-sidebar__nav app-sidebar__nav--stack" aria-label="Telemetry views">
        <DashboardViewLinks onNavigate={handleNav} />
      </nav>

      <div className="app-sidebar__rail-footer">
        {user ? (
          <div className="app-sidebar__user" aria-label="Account">
            <div className="app-sidebar__user-email" title={user.email}>
              {user.displayName ?? user.email}
            </div>
            <LogoutForm />
          </div>
        ) : null}
        <nav className="app-sidebar__footer" aria-label="Other">
          <SidebarLink
            href="/docs"
            label="Docs"
            mono=""
            monoIcon={<DocsNavIcon />}
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
