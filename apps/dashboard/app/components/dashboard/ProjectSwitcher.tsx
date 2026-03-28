"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setDashboardProjectId } from "@/app/dashboard/actions";

export type ProjectOption = { id: string; name: string; slug: string };

export function ProjectSwitcher({
  projects,
  currentProjectId,
}: {
  projects: ProjectOption[];
  currentProjectId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(currentProjectId);

  useEffect(() => {
    setValue(currentProjectId);
  }, [currentProjectId]);

  if (projects.length <= 1) {
    return (
      <div className="project-switcher project-switcher--single">
        <span className="project-switcher__label">Project</span>
        <span className="project-switcher__name" title={projects[0]?.name}>
          {projects[0]?.name ?? "Default"}
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
          setValue(id);
          startTransition(async () => {
            const r = await setDashboardProjectId(id);
            if (r.ok) router.refresh();
          });
        }}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}
