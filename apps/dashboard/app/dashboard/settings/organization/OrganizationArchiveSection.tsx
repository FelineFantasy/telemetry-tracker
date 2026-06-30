"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveOrganizationAction,
  archiveProjectAction,
} from "@/app/dashboard/actions";
import { Section, SettingsBtn } from "@/app/components/dashboard/settings/settings-ui";
import { toast } from "sonner";

export function OrganizationArchiveSection({
  organizationId,
  organizationName,
  projects,
  canArchiveProject,
  canArchiveOrganization,
}: {
  organizationId: string;
  organizationName: string;
  projects: { id: string; name: string; slug: string }[];
  canArchiveProject: boolean;
  canArchiveOrganization: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [projectPending, setProjectPending] = useState<string | null>(null);

  if (!canArchiveProject && !canArchiveOrganization) {
    return null;
  }

  function onArchiveProject(projectId: string, name: string) {
    if (
      !confirm(
        `Archive project "${name}"? Ingest with its API keys will stop. Historical telemetry remains in the database.`
      )
    ) {
      return;
    }
    setProjectPending(projectId);
    startTransition(async () => {
      const r = await archiveProjectAction(projectId);
      setProjectPending(null);
      if (!r.ok) {
        toast.error(r.error);
      } else {
        toast.success("Project archived");
        router.refresh();
      }
    });
  }

  function onArchiveOrganization() {
    if (
      !confirm(
        `Archive organization "${organizationName}"? All projects in this workspace will stop accepting ingest. This cannot be undone from the dashboard.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const r = await archiveOrganizationAction(organizationId);
      if (!r.ok) {
        toast.error(r.error);
      } else {
        toast.success("Organization archived");
        router.refresh();
      }
    });
  }

  return (
    <Section
      title="Archive workspace"
      description="Soft-delete hides projects from the dashboard and rejects new ingest. Telemetry history is retained for audit. Owner only."
      className="mt-10 max-w-lg border-destructive/25"
    >
      {canArchiveProject && projects.length > 0 ? (
        <ul className="mb-4 list-none space-y-2 p-0">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
            >
              <span className="text-sm font-medium text-foreground">{p.name}</span>
              <SettingsBtn
                type="button"
                variant="outline"
                disabled={pending || projectPending === p.id}
                onClick={() => onArchiveProject(p.id, p.name)}
              >
                {projectPending === p.id ? "Archiving…" : "Archive project"}
              </SettingsBtn>
            </li>
          ))}
        </ul>
      ) : null}

      {canArchiveOrganization ? (
        <SettingsBtn
          type="button"
          variant="danger"
          disabled={pending}
          onClick={onArchiveOrganization}
        >
          {pending ? "Archiving…" : "Archive organization"}
        </SettingsBtn>
      ) : null}
    </Section>
  );
}
