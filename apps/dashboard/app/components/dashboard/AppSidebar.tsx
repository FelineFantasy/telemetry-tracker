"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ORGANIZATION_SETTINGS_NEW_PROJECT_URL,
  ORGANIZATION_SETTINGS_PATH,
} from "@/app/components/OrganizationSettingsNewProjectParam";
import { SidebarBrand } from "@/app/components/sidebar/SidebarBrand";
import { useMobileDrawer } from "@/lib/useMobileDrawer";
import { OrgSwitcher, type OrgOption } from "./OrgSwitcher";
import { ProjectSwitcher, type ProjectOption } from "./ProjectSwitcher";
import { DashboardViewLinks } from "./DashboardViewLinks";
import { LogoutForm } from "./LogoutForm";
import { SidebarLink } from "./SidebarLink";
import { DocsNavIcon } from "./sidebarNavIcons";
import type { DashboardUser } from "@/lib/dashboard-user";

function normalizeDashboardPath(p: string): string {
  const t = p.replace(/\/+$/, "");
  return t === "" ? "/" : t;
}

function accountInitial(displayName: string | null | undefined, email: string): string {
  const s = (displayName?.trim() || email).trim();
  const m = s.match(/[a-zA-Z0-9]/u);
  return (m?.[0] ?? "?").toUpperCase();
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
  const router = useRouter();
  const isMobileDrawer = useMobileDrawer();

  const goToCreateProject = useCallback(() => {
    const here = normalizeDashboardPath(pathname) === ORGANIZATION_SETTINGS_PATH;
    if (here) {
      document.getElementById("create-project-heading")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      queueMicrotask(() => document.getElementById("proj-name")?.focus());
      return;
    }
    router.push(ORGANIZATION_SETTINGS_NEW_PROJECT_URL);
  }, [pathname, router]);

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
          <div className="project-switcher project-switcher--single text-muted-foreground text-sm m-0">
            <p className="m-0">
              No projects in this organization.{" "}
              <button
                type="button"
                className="inline border-0 bg-transparent p-0 text-inherit underline underline-offset-2 cursor-pointer font-inherit rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(138,125,228,0.55)]"
                onClick={goToCreateProject}
              >
                Create one
              </button>
              .
            </p>
            <p className="m-0 mt-1 text-xs leading-snug opacity-90">
              A project always belongs to one organization—it cannot be attached from another
              workspace.
              {organizations.length > 1
                ? " Switch organization above if your telemetry lives elsewhere."
                : null}
            </p>
          </div>
        </div>
      ) : null}

      <p className="app-sidebar__workspace-hint">
        <strong className="text-foreground/90">How this fits together:</strong> an{" "}
        <strong>organization</strong> is your workspace (billing and the people on{" "}
        <strong>Team</strong>). <strong>Projects</strong> live inside it and hold telemetry and{" "}
        <strong>API keys</strong>. <strong>App scope</strong> (top of the page) only filters charts
        by the app name your SDK sends—it is not a separate workspace object.
      </p>

      <nav className="app-sidebar__nav app-sidebar__nav--stack" aria-label="Dashboard navigation">
        <DashboardViewLinks onNavigate={handleNav} />
      </nav>

      <div className="app-sidebar__rail-footer">
        {user ? (
          <div
            className={`app-sidebar__user${compactDesktop ? " app-sidebar__user--rail-collapsed" : ""}`}
          >
            {compactDesktop ? (
              <div
                className="app-sidebar__user-collapsed"
                role="group"
                aria-label={
                  user.displayName
                    ? `Signed in as ${user.displayName}, ${user.email}`
                    : `Signed in as ${user.email}`
                }
                title={user.displayName ? `${user.displayName} (${user.email})` : user.email}
              >
                <span className="app-sidebar__user-avatar" aria-hidden>
                  {accountInitial(user.displayName, user.email)}
                </span>
                <LogoutForm railCollapsed />
              </div>
            ) : (
              <>
                <div className="app-sidebar__user-ident">
                  <p className="app-sidebar__user-label">Signed in as</p>
                  <p className="app-sidebar__user-name" title={user.email}>
                    {user.displayName ?? user.email}
                  </p>
                  {user.displayName ? (
                    <p className="app-sidebar__user-email-secondary" title={user.email}>
                      {user.email}
                    </p>
                  ) : null}
                </div>
                <LogoutForm />
              </>
            )}
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
