"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  buildDashboardHrefWithApp,
  dashboardPathForAppFilter,
} from "@/lib/dashboard-app-href";
import { resolveScopedQueryValue } from "@/lib/overview-scope-url";
import { DashboardPopover } from "./DashboardPopover";
import { NavPickerLabel, NavPickerTrigger } from "./shell-primitives";

export function TopNavAppSwitcher({ apps }: { apps: string[] }) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathForLinks = dashboardPathForAppFilter(pathname);

  const rawApp = searchParams.get("app") ?? "";
  const appValue = resolveScopedQueryValue(rawApp, apps) ?? "";
  const displayApp = appValue || "All";

  useEffect(() => {
    if (apps.length === 0) return;
    if (rawApp === "" || apps.includes(rawApp)) return;
    router.replace(buildDashboardHrefWithApp(pathForLinks, null, searchParams));
  }, [apps, pathForLinks, rawApp, router, searchParams]);

  return (
    <DashboardPopover
      width="w-56"
      trigger={(toggle, open) => (
        <NavPickerTrigger
          onClick={toggle}
          aria-expanded={open}
          aria-label="App"
          className="max-w-[11rem]"
        >
          <NavPickerLabel>App</NavPickerLabel>
          <span className="truncate font-medium">{displayApp}</span>
          <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
        </NavPickerTrigger>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Apps
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface"
            onClick={() => {
              router.push(buildDashboardHrefWithApp(pathForLinks, null, searchParams));
              close();
            }}
          >
            <span className="flex-1">All apps</span>
            {appValue === "" ? <Check className="h-3.5 w-3.5" /> : null}
          </button>
          {apps.map((app) => (
            <button
              key={app}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface"
              onClick={() => {
                router.push(buildDashboardHrefWithApp(pathForLinks, app, searchParams));
                close();
              }}
            >
              <span className="flex-1 truncate">{app}</span>
              {appValue === app ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          ))}
          {apps.length === 0 ? (
            <p className="px-2 py-2 text-[12px] leading-relaxed text-muted-foreground">
              Apps appear when your SDK sends an <code className="text-foreground">app</code> field on
              ingest.
            </p>
          ) : null}
        </div>
      )}
    </DashboardPopover>
  );
}
