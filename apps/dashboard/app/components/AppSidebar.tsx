"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const DASHBOARD_PATHS = ["/", "/overview", "/errors", "/events", "/sessions"] as const;

function buildHref(path: string, app: string | null, otherParams: URLSearchParams): string {
  const params = new URLSearchParams(otherParams);
  if (app) params.set("app", app);
  else params.delete("app");
  const q = params.toString();
  const base = path || "/overview";
  return q ? `${base}?${q}` : base;
}

/** `/` redirects to `/overview`; use `/overview` in links so `?app=` is applied on the real overview route. */
function sidebarPath(pathname: string): string {
  if (pathname === "/") return "/overview";
  return pathname || "/overview";
}

export function AppSidebar({ apps }: { apps: string[] }) {
  const pathname = usePathname() ?? "/";
  const pathForLinks = sidebarPath(pathname);
  const searchParams = useSearchParams();
  const currentApp = searchParams.get("app") ?? "";

  const isDashboard = DASHBOARD_PATHS.some(
    (p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/"))
  );
  if (!isDashboard) return null;

  return (
    <aside className="app-sidebar" aria-label="Dashboard">
      <div className="app-sidebar__body">
        <h2 className="app-sidebar__title">App</h2>
        <nav className="app-sidebar__nav" aria-label="Select application">
          <Link
            href={buildHref(pathForLinks, null, searchParams)}
            className="app-sidebar__link"
            aria-current={!currentApp ? "page" : undefined}
          >
            All apps
          </Link>
          {apps.map((app) => (
            <Link
              key={app}
              href={buildHref(pathForLinks, app, searchParams)}
              className="app-sidebar__link"
              aria-current={currentApp === app ? "page" : undefined}
            >
              {app}
            </Link>
          ))}
        </nav>
      </div>
      <nav className="app-sidebar__footer" aria-label="Other">
        <Link
          href="/docs"
          className="app-sidebar__link app-sidebar__link--footer"
        >
          Docs
        </Link>
      </nav>
    </aside>
  );
}
