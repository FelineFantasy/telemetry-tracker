"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SidebarLink } from "./SidebarLink";
import {
  ApiKeysNavIcon,
  ErrorsNavIcon,
  EventsNavIcon,
  OrgNavIcon,
  OverviewNavIcon,
  SessionsNavIcon,
  TeamNavIcon,
} from "./sidebarNavIcons";

const DASHBOARD_BASE = "/dashboard";

const telemetryViewLinks = [
  { href: `${DASHBOARD_BASE}/overview`, label: "Overview", Icon: OverviewNavIcon },
  { href: `${DASHBOARD_BASE}/errors`, label: "Errors", Icon: ErrorsNavIcon },
  { href: `${DASHBOARD_BASE}/events`, label: "Events", Icon: EventsNavIcon },
  { href: `${DASHBOARD_BASE}/sessions`, label: "Sessions", Icon: SessionsNavIcon },
] as const;

const workspaceViewLinks = [
  { href: `${DASHBOARD_BASE}/settings/organization`, label: "Organization", Icon: OrgNavIcon },
  { href: `${DASHBOARD_BASE}/settings/team`, label: "Team", Icon: TeamNavIcon },
  { href: `${DASHBOARD_BASE}/settings/keys`, label: "API keys", Icon: ApiKeysNavIcon },
] as const;

function isViewCurrent(href: string, pathname: string): boolean {
  if (href === `${DASHBOARD_BASE}/overview`) {
    return (
      pathname === `${DASHBOARD_BASE}/overview` ||
      pathname === "/dashboard" ||
      pathname === "/dashboard/"
    );
  }
  if (href === `${DASHBOARD_BASE}/settings/keys`) {
    return pathname.startsWith(`${DASHBOARD_BASE}/settings/keys`);
  }
  if (href === `${DASHBOARD_BASE}/settings/organization`) {
    return pathname.startsWith(`${DASHBOARD_BASE}/settings/organization`);
  }
  if (href === `${DASHBOARD_BASE}/settings/team`) {
    return pathname.startsWith(`${DASHBOARD_BASE}/settings/team`);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function hrefWithApp(href: string, searchParams: URLSearchParams): string {
  const app = searchParams.get("app");
  if (!app) return href;
  const params = new URLSearchParams(searchParams.toString());
  params.set("app", app);
  return `${href}?${params.toString()}`;
}

export function DashboardViewLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();

  const telemetryLink = ({ href, label, Icon }: (typeof telemetryViewLinks)[number]) => (
    <SidebarLink
      key={href}
      href={hrefWithApp(href, searchParams)}
      label={label}
      mono=""
      monoIcon={<Icon />}
      current={isViewCurrent(href, pathname)}
      onNavigate={onNavigate}
      title={label}
    />
  );

  /** Workspace routes ignore app scope — do not carry `?app=` from telemetry views. */
  const workspaceLink = ({ href, label, Icon }: (typeof workspaceViewLinks)[number]) => (
    <SidebarLink
      key={href}
      href={href}
      label={label}
      mono=""
      monoIcon={<Icon />}
      current={isViewCurrent(href, pathname)}
      onNavigate={onNavigate}
      title={label}
    />
  );

  return (
    <>
      {telemetryViewLinks.map(telemetryLink)}
      <hr className="app-sidebar__nav-separator" aria-hidden="true" />
      {workspaceViewLinks.map(workspaceLink)}
    </>
  );
}
