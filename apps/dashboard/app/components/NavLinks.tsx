"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const DASHBOARD_BASE = "/dashboard";
const dashboardLinks = [
  { href: `${DASHBOARD_BASE}/overview`, label: "Overview" },
  { href: `${DASHBOARD_BASE}/errors`, label: "Errors" },
  { href: `${DASHBOARD_BASE}/events`, label: "Events" },
  { href: `${DASHBOARD_BASE}/sessions`, label: "Sessions" },
];

function isNavCurrent(href: string, pathname: string): boolean {
  if (href === `${DASHBOARD_BASE}/overview`) {
    return pathname === `${DASHBOARD_BASE}/overview` || pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const app = searchParams.get("app");

  function hrefWithApp(href: string): string {
    if (!app) return href;
    const params = new URLSearchParams(searchParams.toString());
    params.set("app", app);
    return `${href}?${params.toString()}`;
  }

  return (
    <>
      {dashboardLinks.map(({ href, label }) => (
        <Link
          key={href}
          href={hrefWithApp(href)}
          className="nav-link"
          aria-current={isNavCurrent(href, pathname) ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </>
  );
}
