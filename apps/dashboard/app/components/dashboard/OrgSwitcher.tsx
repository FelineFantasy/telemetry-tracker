"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setDashboardOrganizationId } from "@/app/dashboard/actions";
import {
  formatOrganizationRailName,
  LEGACY_SEEDED_ORG_NAME,
} from "@/lib/workspace-placeholders";
import { hrefWithoutAppSearchParam } from "@/lib/dashboard-app-href";

export type OrgOption = { id: string; name: string };

export function OrgSwitcher({
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
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    setValue(currentOrganizationId ?? "");
    setSwitchError(null);
  }, [currentOrganizationId]);

  if (organizations.length === 0) {
    return null;
  }

  if (organizations.length === 1) {
    const name = organizations[0]?.name ?? "—";
    const displayName = formatOrganizationRailName(name);
    const isPlaceholder = name === LEGACY_SEEDED_ORG_NAME;
    return (
      <div
        className="project-switcher project-switcher--single"
        role="group"
        aria-label={`Organization: ${displayName}`}
      >
        <span className="project-switcher__label">Organization</span>
        <span
          className="project-switcher__name"
          title={
            isPlaceholder
              ? `Database name: "${name}". Rename under Organization → Settings.`
              : name
          }
        >
          {displayName}
        </span>
        {isPlaceholder ? (
          <Link
            href="/dashboard/settings/organization"
            className="project-switcher__rename-hint"
          >
            Manage workspace
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="project-switcher">
      <label htmlFor="telemetry-org-switch" className="project-switcher__label">
        Organization
      </label>
      <select
        id="telemetry-org-switch"
        className="project-switcher__select"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          const previousSelection = value;
          setSwitchError(null);
          setValue(id);
          startTransition(async () => {
            const r = await setDashboardOrganizationId(id);
            if (r.ok) {
              router.replace(hrefWithoutAppSearchParam(pathname, searchParams));
              router.refresh();
              return;
            }
            setValue(previousSelection);
            setSwitchError(r.error);
          });
        }}
      >
        {organizations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {switchError ? (
        <p className="project-switcher__error" role="alert">
          {switchError}
        </p>
      ) : null}
    </div>
  );
}
