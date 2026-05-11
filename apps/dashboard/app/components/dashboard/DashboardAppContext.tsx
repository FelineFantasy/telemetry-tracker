"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { loadDashboardApps } from "@/app/dashboard/actions";
import { DashboardCustomSelect } from "@/app/components/dashboard/DashboardCustomSelect";
import type { DashboardSelectOption } from "@/app/components/dashboard/DashboardCustomSelect";
import {
  buildDashboardHrefWithApp,
  dashboardPathForAppFilter,
} from "@/lib/dashboard-app-href";

/**
 * Scope control (which app’s telemetry) — lives in the content column, not the nav rail,
 * matching common dashboard patterns (project/environment in header or toolbar).
 */
export function DashboardAppContext({
  apps: appsFromLayout,
  currentOrganizationId,
  currentProjectId,
}: {
  apps: string[];
  currentOrganizationId: string | null;
  currentProjectId: string;
}) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathForLinks = dashboardPathForAppFilter(pathname);
  const rawApp = searchParams.get("app") ?? "";

  const [apps, setApps] = useState(appsFromLayout);
  const skipProjectFetchRef = useRef(true);

  useEffect(() => {
    setApps(appsFromLayout);
  }, [appsFromLayout]);

  useEffect(() => {
    if (skipProjectFetchRef.current) {
      skipProjectFetchRef.current = false;
      return;
    }
    let cancelled = false;
    void loadDashboardApps(currentProjectId, currentOrganizationId).then((next) => {
      if (!cancelled && next !== null) setApps(next);
    });
    return () => {
      cancelled = true;
    };
  }, [currentOrganizationId, currentProjectId]);

  /** `app` query must name an app that exists for this project — no ad-hoc options. */
  const value = rawApp !== "" && apps.includes(rawApp) ? rawApp : "";

  useEffect(() => {
    if (apps.length === 0) return;
    if (rawApp === "" || apps.includes(rawApp)) return;
    router.replace(buildDashboardHrefWithApp(pathForLinks, null, searchParams));
  }, [apps, pathForLinks, rawApp, router, searchParams]);

  const uid = useId().replace(/:/g, "");
  const labelId = `dash-app-scope-l-${uid}`;
  const triggerId = `dash-app-scope-t-${uid}`;

  const options = useMemo((): DashboardSelectOption[] => {
    const o: DashboardSelectOption[] = [{ value: "", label: "All apps" }];
    for (const app of apps) {
      o.push({ value: app, label: app });
    }
    return o;
  }, [apps]);

  const onValueChange = useCallback(
    (next: string) => {
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
      <div className="dashboard-app-context__row">
        <span id={labelId} className="dashboard-app-context__label">
          App scope
        </span>
        <DashboardCustomSelect
          value={value}
          options={options}
          triggerId={triggerId}
          listLabelledBy={labelId}
          onValueChange={onValueChange}
        />
      </div>
      <p className="dashboard-app-context__hint m-0">
        These names come from telemetry for the <strong>selected project</strong>—each event
        includes an <strong>app</strong> string from your SDK. This control only filters what you
        see; it does not create apps or move data between projects.
      </p>
    </div>
  );
}
