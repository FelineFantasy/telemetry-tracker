"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MenuIcon } from "@/app/components/sidebar/MenuIcon";
import { AppSidebar } from "./AppSidebar";
import { DashboardCapabilitiesProvider } from "./DashboardCapabilitiesContext";
import type { OrgOption } from "./OrgSwitcher";
import type { ProjectOption } from "./ProjectSwitcher";
import { DashboardAppContext } from "./DashboardAppContext";
import type { DashboardSessionContext } from "@/lib/dashboard-capabilities";
import type { DashboardUser } from "@/lib/dashboard-user";

const SIDEBAR_COLLAPSED_KEY = "telemetry-dashboard-sidebar-collapsed";
const BILLING_TOAST_SESSION_KEY = "tt_dashboard_billing_toast_v1";

export function DashboardShell({
  apps,
  children,
  organizations = [],
  currentOrganizationId = null,
  projects = [],
  currentProjectId = "",
  user = null,
  capabilities = null,
}: {
  apps: string[];
  children: React.ReactNode;
  organizations?: OrgOption[];
  currentOrganizationId?: string | null;
  projects?: ProjectOption[];
  currentProjectId?: string;
  user?: DashboardUser | null;
  capabilities?: DashboardSessionContext | null;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const billingToastShownRef = useRef(false);

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

  useEffect(() => {
    if (!capabilities || billingToastShownRef.current) return;
    try {
      if (sessionStorage.getItem(BILLING_TOAST_SESSION_KEY) === "1") {
        billingToastShownRef.current = true;
        return;
      }
      sessionStorage.setItem(BILLING_TOAST_SESSION_KEY, "1");
    } catch {
      /* ignore */
    }
    billingToastShownRef.current = true;
    toast.message("Stripe billing", {
      id: "dashboard-billing-info",
      description:
        "Plan tier syncs from Stripe after checkout or when a subscription ends. Failed payments, past-due invoices, and card errors are not shown in this app—check Stripe's emails or your billing portal.",
      duration: 12_000,
    });
  }, [capabilities]);

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
        organizations={organizations}
        currentOrganizationId={currentOrganizationId}
        projects={projects}
        currentProjectId={currentProjectId}
        user={user}
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
          <DashboardCapabilitiesProvider value={capabilities}>
            {capabilities?.usageQuota?.nearQuota ? (
              <div
                className={
                  capabilities.usageQuota.quotaExceeded
                    ? "quota-near-banner mx-auto mb-4 max-w-[1400px] rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground"
                    : "quota-near-banner mx-auto mb-4 max-w-[1400px] rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-foreground"
                }
                role="status"
              >
                {capabilities.usageQuota.quotaExceeded ? (
                  <>
                    Monthly ingest is at or above your{" "}
                    <strong>{capabilities.usageQuota.planTier}</strong> plan limit (
                    {capabilities.usageQuota.monthlyIngestUsed.toLocaleString()} /{" "}
                    {capabilities.usageQuota.monthlyIngestLimit.toLocaleString()} units this
                    month, <strong>{capabilities.usageQuota.percentUsed}%</strong>). New
                    ingest is being rejected until usage drops or you upgrade.
                  </>
                ) : (
                  <>
                    Monthly ingest usage is high:{" "}
                    <strong>{capabilities.usageQuota.percentUsed}%</strong> of your{" "}
                    <strong>{capabilities.usageQuota.planTier}</strong> plan limit (
                    {capabilities.usageQuota.monthlyIngestUsed.toLocaleString()} /{" "}
                    {capabilities.usageQuota.monthlyIngestLimit.toLocaleString()} units this
                    month). Ingest may be rejected if the limit is reached.
                  </>
                )}
              </div>
            ) : null}
            <DashboardAppContext apps={apps} />
            {children}
          </DashboardCapabilitiesProvider>
        </main>
      </div>
    </div>
  );
}
