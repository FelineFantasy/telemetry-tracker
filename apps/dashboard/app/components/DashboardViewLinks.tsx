"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

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
        <Link
          key={href}
          href={hrefWithApp(href, searchParams)}
          className="app-sidebar__link"
          aria-current={isViewCurrent(href, pathname) ? "page" : undefined}
          onClick={onNavigate}
          title={label}
        >
          <span className="app-sidebar__link-mono" aria-hidden>
            {mono}
          </span>
          <span className="app-sidebar__link-label">{label}</span>
        </Link>
      ))}
    </>
  );
}
