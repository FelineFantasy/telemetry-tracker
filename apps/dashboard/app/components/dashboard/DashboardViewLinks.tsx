"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SidebarLink } from "./SidebarLink";

const DASHBOARD_BASE = "/dashboard";

const dashboardViewLinks = [
  { href: `${DASHBOARD_BASE}/overview`, label: "Overview", mono: "Ov" },
  { href: `${DASHBOARD_BASE}/errors`, label: "Errors", mono: "Er" },
  { href: `${DASHBOARD_BASE}/events`, label: "Events", mono: "Ev" },
  { href: `${DASHBOARD_BASE}/sessions`, label: "Sessions", mono: "Se" },
] as const;

function isViewCurrent(href: string, pathname: string): boolean {
  if (href === `${DASHBOARD_BASE}/overview`) {
    return (
      pathname === `${DASHBOARD_BASE}/overview` ||
      pathname === "/dashboard" ||
      pathname === "/dashboard/"
    );
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
      {dashboardViewLinks.map(({ href, label, mono }) => (
        <SidebarLink
          key={href}
          href={hrefWithApp(href, searchParams)}
          label={label}
          mono={mono}
          current={isViewCurrent(href, pathname)}
          onNavigate={onNavigate}
          title={label}
        />
      ))}
    </>
  );
}
