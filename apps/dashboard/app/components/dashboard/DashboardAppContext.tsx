"use client";

import { useCallback, useEffect, useId, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DashboardCustomSelect } from "@/app/components/dashboard/DashboardCustomSelect";
import type { DashboardSelectOption } from "@/app/components/dashboard/DashboardCustomSelect";
import {
  buildDashboardHrefWithApp,
  dashboardPathForAppFilter,
} from "@/lib/dashboard-app-href";

/**
 * Scope control (which app’s telemetry) — lives in the content column, not the nav rail.
 */
export function DashboardAppContext({ apps }: { apps: string[] }) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathForLinks = dashboardPathForAppFilter(pathname);
  const rawApp = searchParams.get("app") ?? "";

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
    <div className="mb-6 rounded-xl border border-border bg-surface/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span id={labelId} className="text-[12px] font-medium text-muted-foreground">
          App scope
        </span>
        <div className="min-w-[10rem] max-w-xs flex-1">
          <DashboardCustomSelect
            value={value}
            options={options}
            triggerId={triggerId}
            listLabelledBy={labelId}
            onValueChange={onValueChange}
          />
        </div>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        These names come from telemetry for the <strong className="text-foreground">selected project</strong>—each event
        includes an <strong className="text-foreground">app</strong> string from your SDK. This control only filters what you
        see; it does not create apps or move data between projects.
      </p>
    </div>
  );
}
