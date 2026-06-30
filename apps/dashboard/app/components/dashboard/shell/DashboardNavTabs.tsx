"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DASHBOARD_NAV } from "./dashboard-nav";

export function DashboardNavTabs() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="border-t border-border">
      <div className="mx-auto flex max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <ul className="flex items-center gap-0.5 overflow-x-auto py-0.5">
          {DASHBOARD_NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] transition-colors ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                  {item.comingSoon ? (
                    <span className="rounded border border-border px-1 py-px font-mono text-[9px] uppercase text-muted-foreground">
                      Soon
                    </span>
                  ) : null}
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-px h-px bg-foreground" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
