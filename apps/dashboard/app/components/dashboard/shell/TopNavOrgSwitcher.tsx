"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronDown, Plus, Users } from "lucide-react";
import { setDashboardOrganizationId } from "@/app/dashboard/actions";
import { hrefWithoutAppSearchParam } from "@/lib/dashboard-app-href";
import { useDashboardNavigation } from "@/lib/use-dashboard-navigation";
import {
  formatOrganizationRailName,
  LEGACY_SEEDED_ORG_NAME,
} from "@/lib/workspace-placeholders";
import type { OrgOption } from "@/lib/dashboard-workspace-types";
import { DashboardPopover } from "./DashboardPopover";
import { NavPickerTrigger } from "./shell-primitives";

export function TopNavOrgSwitcher({
  organizations,
  currentOrganizationId,
}: {
  organizations: OrgOption[];
  currentOrganizationId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const { replace, runPending, isPending: pending } = useDashboardNavigation();
  const [value, setValue] = useState(currentOrganizationId ?? "");

  useEffect(() => {
    setValue(currentOrganizationId ?? "");
  }, [currentOrganizationId]);

  if (organizations.length === 0) {
    return (
      <Link
        href="/dashboard/settings/organization"
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-sm hover:bg-surface"
      >
        Create organization
      </Link>
    );
  }

  const current =
    organizations.find((o) => o.id === value) ?? organizations[0]!;
  const displayName = formatOrganizationRailName(current.name);

  return (
    <DashboardPopover
      width="w-72"
      trigger={(toggle, open) => (
        <NavPickerTrigger
          onClick={toggle}
          disabled={pending}
          aria-expanded={open}
          aria-label="Organization"
        >
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-brand text-[10px] font-semibold text-primary-foreground">
            {displayName.charAt(0).toUpperCase()}
          </span>
          <span className="truncate">{displayName}</span>
          <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
        </NavPickerTrigger>
      )}
    >
      {(close) => (
        <div className="p-1.5">
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Organizations
          </div>
          {organizations.map((o) => {
            const name = formatOrganizationRailName(o.name);
            const active = o.id === value;
            return (
              <button
                key={o.id}
                type="button"
                disabled={pending}
                onClick={() => {
                  if (organizations.length === 1) {
                    close();
                    return;
                  }
                  setValue(o.id);
                  void runPending(async () => {
                    const r = await setDashboardOrganizationId(o.id);
                    if (r.ok) {
                      replace(hrefWithoutAppSearchParam(pathname, searchParams));
                      router.refresh();
                      close();
                    } else {
                      setValue(currentOrganizationId ?? "");
                    }
                  });
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface"
              >
                <span className="grid h-6 w-6 place-items-center rounded bg-brand/80 text-[11px] font-semibold text-primary-foreground">
                  {name.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 text-left">{name}</span>
                {active ? <Check className="h-3.5 w-3.5" /> : null}
              </button>
            );
          })}
          {current.name === LEGACY_SEEDED_ORG_NAME ? (
            <p className="px-2 py-2 text-[12px] text-muted-foreground">
              <Link
                href="/dashboard/settings/organization"
                onClick={close}
                className="text-brand hover:underline"
              >
                Rename your workspace
              </Link>
            </p>
          ) : null}
          <div className="my-1 h-px bg-border" />
          <Link
            href="/dashboard/settings/organization"
            onClick={close}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Create organization
          </Link>
          <Link
            href="/dashboard/settings/team"
            onClick={close}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <Users className="h-3.5 w-3.5" />
            Invite team member
          </Link>
        </div>
      )}
    </DashboardPopover>
  );
}
