"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { renameProjectAction } from "@/app/dashboard/actions";
import {
  Section,
  SettingsBtn,
  SettingsInput,
} from "@/app/components/dashboard/settings/settings-ui";
import { toast } from "sonner";

type ProjectRow = { id: string; name: string; slug: string };

export function OrganizationProjectsSection({
  projects,
  canRename,
}: {
  projects: ProjectRow[];
  canRename: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (projects.length === 0) return null;

  function onSave(project: ProjectRow, form: HTMLFormElement) {
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    const slug = String(fd.get("slug") ?? "").trim();
    if (!name) {
      toast.error("Project name is required");
      return;
    }
    if (!slug) {
      toast.error("Slug is required");
      return;
    }
    if (name === project.name && slug === project.slug) {
      toast.message("No changes to save");
      return;
    }
    setPendingId(project.id);
    startTransition(async () => {
      const r = await renameProjectAction(project.id, { name, slug });
      setPendingId(null);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Project updated");
      router.refresh();
    });
  }

  return (
    <div id="projects-section" className="scroll-mt-24">
      <Section
        title="Projects"
        description={
          canRename
            ? "Rename a project’s display name or slug. Slugs must be unique within the organization."
            : "Projects in this organization. Only owners can rename projects."
        }
        className="mt-6 max-w-lg"
      >
        <ul className="m-0 list-none space-y-4 p-0">
          {projects.map((p) => (
            <li
              key={p.id}
              id={`rename-project-${p.id}`}
              className="scroll-mt-24 rounded-lg border border-border px-3 py-3"
            >
              {canRename ? (
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSave(p, e.currentTarget);
                  }}
                >
                  <label
                    className="text-[13px] text-muted-foreground"
                    htmlFor={`proj-name-${p.id}`}
                  >
                    Name
                  </label>
                  <SettingsInput
                    id={`proj-name-${p.id}`}
                    name="name"
                    type="text"
                    required
                    maxLength={120}
                    defaultValue={p.name}
                    disabled={pending && pendingId === p.id}
                  />
                  <label
                    className="text-[13px] text-muted-foreground"
                    htmlFor={`proj-slug-${p.id}`}
                  >
                    Slug
                  </label>
                  <SettingsInput
                    id={`proj-slug-${p.id}`}
                    name="slug"
                    type="text"
                    required
                    maxLength={120}
                    defaultValue={p.slug}
                    autoComplete="off"
                    mono
                    disabled={pending && pendingId === p.id}
                  />
                  <SettingsBtn
                    type="submit"
                    variant="primary"
                    disabled={pending && pendingId === p.id}
                  >
                    {pending && pendingId === p.id ? "Saving…" : "Save changes"}
                  </SettingsBtn>
                </form>
              ) : (
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                  <span className="font-mono text-[12px] text-muted-foreground">
                    {p.slug}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
