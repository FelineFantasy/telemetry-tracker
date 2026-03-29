"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SidebarLink } from "./SidebarLink";
import {
  ApiKeysNavIcon,
  ErrorsNavIcon,
  EventsNavIcon,
  OverviewNavIcon,
  SessionsNavIcon,
  TeamNavIcon,
} from "./sidebarNavIcons";

const DASHBOARD_BASE = "/dashboard";

const dashboardViewLinks = [
  { href: `${DASHBOARD_BASE}/overview`, label: "Overview", Icon: OverviewNavIcon },
  { href: `${DASHBOARD_BASE}/errors`, label: "Errors", Icon: ErrorsNavIcon },
  { href: `${DASHBOARD_BASE}/events`, label: "Events", Icon: EventsNavIcon },
  { href: `${DASHBOARD_BASE}/sessions`, label: "Sessions", Icon: SessionsNavIcon },
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

  return (
    <>
      {dashboardViewLinks.map(({ href, label, Icon }) => (
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
      ))}
    </>
  );
}
