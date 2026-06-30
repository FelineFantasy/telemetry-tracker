"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import { dashboardPathForAppFilter } from "@/lib/dashboard-app-href";
import { buildDashboardHrefWithEnvironment, resolveScopedQueryValue } from "@/lib/overview-scope-url";
import { DashboardPopover } from "./DashboardPopover";
import { NavPickerLabel, NavPickerTrigger } from "./shell-primitives";

export function DashboardEnvSelector({ environments }: { environments: string[] }) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathForLinks = dashboardPathForAppFilter(pathname);

  const rawEnv = searchParams.get("environment") ?? "";
  const envValue = resolveScopedQueryValue(rawEnv, environments) ?? "";
  const displayEnv = envValue || "All";

  useEffect(() => {
    if (rawEnv === "" || environments.includes(rawEnv)) return;
    router.replace(
      buildDashboardHrefWithEnvironment(pathForLinks, null, searchParams)
    );
  }, [environments, pathForLinks, rawEnv, router, searchParams]);

  return (
    <DashboardPopover
      width="w-52"
      trigger={(toggle, open) => (
        <NavPickerTrigger
          onClick={toggle}
          aria-expanded={open}
          aria-label="Environment"
          className="max-w-[10rem]"
        >
          <NavPickerLabel>Env</NavPickerLabel>
          <span className="truncate font-medium uppercase">{displayEnv}</span>
          <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
        </NavPickerTrigger>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Environments
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface"
            onClick={() => {
              router.push(buildDashboardHrefWithEnvironment(pathForLinks, null, searchParams));
              close();
            }}
          >
            <span className="flex-1">All environments</span>
            {envValue === "" ? <Check className="h-3.5 w-3.5" /> : null}
          </button>
          {environments.map((e) => (
            <button
              key={e}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface"
              onClick={() => {
                router.push(buildDashboardHrefWithEnvironment(pathForLinks, e, searchParams));
                close();
              }}
            >
              <span className="flex-1">{e}</span>
              {envValue === e ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          ))}
          {environments.length === 0 ? (
            <p className="px-2 py-2 text-[12px] leading-relaxed text-muted-foreground">
              Environments appear when your SDK sends an <code className="text-foreground">environment</code>{" "}
              field on ingest.
            </p>
          ) : null}
        </div>
      )}
    </DashboardPopover>
  );
}
