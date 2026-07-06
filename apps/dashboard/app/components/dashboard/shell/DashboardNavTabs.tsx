"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ComingSoonBadge } from "@/app/components/dashboard/coming-soon-ui";
import { buildDashboardNavTabHref } from "@/lib/overview-scope-url";
import { DASHBOARD_NAV } from "./dashboard-nav";

export function DashboardNavTabs() {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();

  return (
    <nav className="border-t border-border" aria-label="Dashboard sections">
      <div className="mx-auto w-full min-w-0 max-w-7xl overflow-hidden px-4 sm:px-6 lg:px-8">
        <ul className="scrollbar-hide flex snap-x snap-mandatory items-center gap-0.5 overflow-x-auto scroll-smooth py-0.5 [-webkit-overflow-scrolling:touch]">
          {DASHBOARD_NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            const href = buildDashboardNavTabHref(item.href, searchParams);
            return (
              <li key={item.href} className="shrink-0 snap-start">
                <Link
                  href={href}
                  className={`relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[13px] transition-colors ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                  {item.comingSoon ? <ComingSoonBadge /> : null}
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
