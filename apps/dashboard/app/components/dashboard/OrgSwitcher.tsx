"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setDashboardOrganizationId } from "@/app/dashboard/actions";

export type OrgOption = { id: string; name: string };

export function OrgSwitcher({
  organizations,
  currentOrganizationId,
}: {
  organizations: OrgOption[];
  currentOrganizationId: string | null;
}) {
  const router = useRouter();
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
    return (
      <div className="project-switcher project-switcher--single">
        <span className="project-switcher__label">Organization</span>
        <span className="project-switcher__name" title={organizations[0]?.name}>
          {organizations[0]?.name ?? "—"}
        </span>
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
