"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { DashboardCustomSelect } from "@/app/components/dashboard/DashboardCustomSelect";
import type { DashboardSelectOption } from "@/app/components/dashboard/DashboardCustomSelect";
import { SettingsBtn } from "@/app/components/dashboard/settings/settings-ui";
import { buildDashboardHrefWithApp } from "@/lib/dashboard-app-href";
import { dashboardPathForAppFilter } from "@/lib/dashboard-app-href";
import {
  buildDashboardHrefWithEnvironment,
  resolveScopedQueryValue,
} from "@/lib/overview-scope-url";

type Props = {
  organizationName: string | null;
  projectName: string | null;
  apps: string[];
  environments: string[];
  rangeLabel: string;
};

export function DashboardScopeBar({
  organizationName,
  projectName,
  apps,
  environments,
  rangeLabel,
}: Props) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathForLinks = dashboardPathForAppFilter(pathname);

  const rawApp = searchParams.get("app") ?? "";
  const appValue = resolveScopedQueryValue(rawApp, apps) ?? "";
  const rawEnv = searchParams.get("environment") ?? "";
  const envValue = resolveScopedQueryValue(rawEnv, environments) ?? "";

  useEffect(() => {
    if (rawEnv === "" || environments.includes(rawEnv)) return;
    router.replace(
      buildDashboardHrefWithEnvironment(pathForLinks, null, searchParams)
    );
  }, [environments, pathForLinks, rawEnv, router, searchParams]);

  const envOptions = useMemo((): DashboardSelectOption[] => {
    const o: DashboardSelectOption[] = [{ value: "", label: "All environments" }];
    for (const e of environments) o.push({ value: e, label: e });
    return o;
  }, [environments]);

  const appOptions = useMemo((): DashboardSelectOption[] => {
    const o: DashboardSelectOption[] = [{ value: "", label: "All apps" }];
    for (const app of apps) o.push({ value: app, label: app });
    return o;
  }, [apps]);

  const onAppChange = useCallback(
    (next: string) => {
      router.push(buildDashboardHrefWithApp(pathForLinks, next === "" ? null : next, searchParams));
    },
    [pathForLinks, router, searchParams]
  );

  const onEnvChange = useCallback(
    (next: string) => {
      router.push(
        buildDashboardHrefWithEnvironment(pathForLinks, next === "" ? null : next, searchParams)
      );
    },
    [pathForLinks, router, searchParams]
  );

  const filters = [
    { key: "org", label: "org", value: organizationName ?? "—" },
    { key: "project", label: "project", value: projectName ?? "—" },
    ...(envValue ? [{ key: "env", label: "env", value: envValue }] : []),
    { key: "range", label: "range", value: rangeLabel },
    ...(appValue ? [{ key: "app", label: "app", value: appValue }] : []),
  ];

  return (
    <div className="mb-6 space-y-3 rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12px] font-medium text-muted-foreground">Scope</span>
        {environments.length > 0 ? (
          <div className="min-w-[8rem]">
            <DashboardCustomSelect
              value={envValue}
              options={envOptions}
              triggerId="scope-env"
              listLabelledBy="scope-env-l"
              onValueChange={onEnvChange}
            />
          </div>
        ) : null}
        {apps.length > 0 ? (
          <div className="min-w-[8rem]">
            <DashboardCustomSelect
              value={appValue}
              options={appOptions}
              triggerId="scope-app"
              listLabelledBy="scope-app-l"
              onValueChange={onAppChange}
            />
          </div>
        ) : null}
        <SettingsBtn
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() =>
            toast.message("Saved views", {
              description: "Bookmark this URL to return to the same scope and range.",
            })
          }
        >
          Save view
        </SettingsBtn>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Filters active</span>
        {filters.map((f) => (
          <span
            key={f.key}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1 text-[12px]"
          >
            <span className="font-mono text-[10px] uppercase text-muted-foreground">{f.label}</span>
            <span className="max-w-[12rem] truncate">{f.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
