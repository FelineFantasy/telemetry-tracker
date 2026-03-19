"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const dashboardLinks = [
  { href: "/overview", label: "Overview" },
  { href: "/errors", label: "Errors" },
  { href: "/events", label: "Events" },
  { href: "/sessions", label: "Sessions" },
];

function isNavCurrent(href: string, pathname: string): boolean {
  if (href === "/overview") {
    return pathname === "/overview" || pathname === "/";
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
          aria-current={isNavCurrent(href, pathname) ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </>
  );
}
