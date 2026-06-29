"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setDashboardProjectId } from "@/app/dashboard/actions";
import { hrefWithoutAppSearchParam } from "@/lib/dashboard-app-href";
import {
  formatProjectRailName,
  LEGACY_SEEDED_PROJECT_NAME,
} from "@/lib/workspace-placeholders";

export type ProjectOption = { id: string; name: string; slug: string };

export function ProjectSwitcher({
  projects,
  currentProjectId,
}: {
  projects: ProjectOption[];
  currentProjectId: string;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(currentProjectId);
  const [switchError, setSwitchError] = useState<string | null>(null);

  useEffect(() => {
    setValue(currentProjectId);
    setSwitchError(null);
  }, [currentProjectId]);

  if (projects.length <= 1) {
    const p = projects[0];
    const name = p?.name ?? "Default";
    const slug = p?.slug ?? "";
    const displayName = formatProjectRailName(name, slug);
    const isPlaceholder = name === LEGACY_SEEDED_PROJECT_NAME && slug === "default";
    return (
      <div
        className="project-switcher project-switcher--single"
        role="group"
        aria-label={`Project: ${displayName}`}
      >
        <span className="project-switcher__label">Project</span>
        <span
          className="project-switcher__name"
          title={
            isPlaceholder
              ? `The first project row created when this workspace was provisioned (stored as “${name}”). Not a separate product tier—add more projects under Organization → Settings if you need them.`
              : `${name}${slug ? ` · ${slug}` : ""}`
          }
        >
          {displayName}
        </span>
      </div>
    );
  }

  return (
    <div className="project-switcher">
      <label htmlFor="telemetry-project-switch" className="project-switcher__label">
        Project
      </label>
      <select
        id="telemetry-project-switch"
        className="project-switcher__select"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          const previousSelection = value;
          setSwitchError(null);
          setValue(id);
          startTransition(async () => {
            const r = await setDashboardProjectId(id);
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
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
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
