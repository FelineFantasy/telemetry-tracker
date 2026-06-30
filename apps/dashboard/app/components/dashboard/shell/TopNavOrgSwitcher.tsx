"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Check, ChevronDown, Plus, Users } from "lucide-react";
import { setDashboardOrganizationId } from "@/app/dashboard/actions";
import { hrefWithoutAppSearchParam } from "@/lib/dashboard-app-href";
import {
  formatOrganizationRailName,
  LEGACY_SEEDED_ORG_NAME,
} from "@/lib/workspace-placeholders";
import type { OrgOption } from "@/lib/dashboard-workspace-types";
import { DashboardPopover } from "./DashboardPopover";

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
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(currentOrganizationId ?? "");

  useEffect(() => {
    setValue(currentOrganizationId ?? "");
  }, [currentOrganizationId]);

  if (organizations.length === 0) return null;

  const current =
    organizations.find((o) => o.id === value) ?? organizations[0]!;
  const displayName = formatOrganizationRailName(current.name);

  if (organizations.length === 1) {
    return (
      <div className="inline-flex max-w-[7rem] items-center gap-1.5 truncate rounded-md px-2 py-1.5 text-sm sm:max-w-none">
        <span className="grid h-5 w-5 place-items-center rounded bg-brand text-[10px] font-semibold text-primary-foreground">
          {displayName.charAt(0)}
        </span>
        <span>{displayName.split(" ")[0]}</span>
        {current.name === LEGACY_SEEDED_ORG_NAME ? (
          <Link
            href="/dashboard/settings/organization"
            className="text-[11px] text-brand hover:underline"
          >
            Rename
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <DashboardPopover
      width="w-72"
      trigger={(toggle, open) => (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-expanded={open}
          className="inline-flex max-w-[7rem] items-center gap-1.5 truncate rounded-md px-2 py-1.5 text-sm hover:bg-surface/60 sm:max-w-none"
        >
          <span className="grid h-5 w-5 place-items-center rounded bg-brand text-[10px] font-semibold text-primary-foreground">
            {displayName.charAt(0)}
          </span>
          <span>{displayName.split(" ")[0]}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
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
                  setValue(o.id);
                  startTransition(async () => {
                    const r = await setDashboardOrganizationId(o.id);
                    if (r.ok) {
                      router.replace(hrefWithoutAppSearchParam(pathname, searchParams));
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
                  {name.charAt(0)}
                </span>
                <span className="flex-1 text-left">{name}</span>
                {active ? <Check className="h-3.5 w-3.5" /> : null}
              </button>
            );
          })}
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
