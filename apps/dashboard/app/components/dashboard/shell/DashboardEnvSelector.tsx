"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { DashboardPopover } from "./DashboardPopover";
import { buildDashboardHrefWithEnvironment, resolveScopedQueryValue } from "@/lib/overview-scope-url";
import { dashboardPathForAppFilter } from "@/lib/dashboard-app-href";

export function DashboardEnvSelector({ environments }: { environments: string[] }) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathForLinks = dashboardPathForAppFilter(pathname);

  const rawEnv = searchParams.get("environment") ?? "";
  const envValue = resolveScopedQueryValue(rawEnv, environments) ?? "";
  const label = envValue || "All";

  useEffect(() => {
    if (rawEnv === "" || environments.includes(rawEnv)) return;
    router.replace(
      buildDashboardHrefWithEnvironment(pathForLinks, null, searchParams)
    );
  }, [environments, pathForLinks, rawEnv, router, searchParams]);

  if (environments.length === 0) return null;

  return (
    <DashboardPopover
      width="w-44"
      trigger={(toggle, open) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label="Environment"
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface/60 px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <span className="font-mono text-[10px] uppercase">env</span>
          <span className="max-w-[5rem] truncate text-foreground">{label}</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          <button
            type="button"
            className="flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface"
            onClick={() => {
              router.push(buildDashboardHrefWithEnvironment(pathForLinks, null, searchParams));
              close();
            }}
          >
            All environments
          </button>
          {environments.map((e) => (
            <button
              key={e}
              type="button"
              className="flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface"
              onClick={() => {
                router.push(buildDashboardHrefWithEnvironment(pathForLinks, e, searchParams));
                close();
              }}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </DashboardPopover>
  );
}
