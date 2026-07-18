export type DashboardNavItem = {
  href: string;
  label: string;
  enabled: boolean;
  comingSoon?: boolean;
};

export const DASHBOARD_NAV: DashboardNavItem[] = [
  { href: "/dashboard/overview", label: "Overview", enabled: true },
  { href: "/dashboard/errors", label: "Issues", enabled: true },
  { href: "/dashboard/events", label: "Events", enabled: true },
  { href: "/dashboard/sessions", label: "Sessions", enabled: true },
  { href: "/dashboard/traces", label: "Traces", enabled: false, comingSoon: true },
  { href: "/dashboard/logs", label: "Logs", enabled: false, comingSoon: true },
  { href: "/dashboard/performance", label: "Performance", enabled: true },
  { href: "/dashboard/releases", label: "Releases", enabled: true },
  { href: "/dashboard/alerts", label: "Alerts", enabled: true },
  { href: "/dashboard/notifications", label: "Notifications", enabled: true },
  { href: "/dashboard/flags", label: "Flags", enabled: false, comingSoon: true },
  { href: "/dashboard/dashboards", label: "Dashboards", enabled: false, comingSoon: true },
];

export function navLabelForPath(pathname: string): string | undefined {
  const item = DASHBOARD_NAV.find(
    (n) => pathname === n.href || pathname.startsWith(`${n.href}/`)
  );
  return item?.label;
}
