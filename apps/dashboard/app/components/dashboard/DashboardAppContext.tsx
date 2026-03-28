"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildDashboardHrefWithApp,
  dashboardPathForAppFilter,
} from "@/lib/dashboard-app-href";

/**
 * Scope control (which app’s telemetry) — lives in the content column, not the nav rail,
 * matching common dashboard patterns (project/environment in header or toolbar).
 */
export function DashboardAppContext({ apps }: { apps: string[] }) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathForLinks = dashboardPathForAppFilter(pathname);
  const rawApp = searchParams.get("app") ?? "";
  const orphanApp = rawApp !== "" && !apps.includes(rawApp) ? rawApp : null;
  const value = orphanApp ?? rawApp;

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const next = e.target.value;
      const href = buildDashboardHrefWithApp(
        pathForLinks,
        next === "" ? null : next,
        searchParams
      );
      router.push(href);
    },
    [pathForLinks, router, searchParams]
  );

  if (apps.length === 0) return null;

  return (
    <div className="dashboard-app-context">
      <label htmlFor="dashboard-app-scope" className="dashboard-app-context__label">
        App scope
      </label>
      <select
        id="dashboard-app-scope"
        className="dashboard-app-context__select"
        value={value}
        onChange={onChange}
        aria-label="Filter telemetry by application"
      >
        <option value="">All apps</option>
        {orphanApp ? (
          <option value={orphanApp}>
            {orphanApp} (not in list)
          </option>
        ) : null}
        {apps.map((app) => (
          <option key={app} value={app}>
            {app}
          </option>
        ))}
      </select>
    </div>
  );
}
