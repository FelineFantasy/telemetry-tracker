"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { renameProjectAction } from "@/app/dashboard/actions";
import {
  Section,
  SettingsBtn,
  SettingsInput,
} from "@/app/components/dashboard/settings/settings-ui";
import { toast } from "sonner";

type ProjectRow = { id: string; name: string; slug: string };

function ProjectRenameForm({ project }: { project: ProjectRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(project.name);
  const [slug, setSlug] = useState(project.slug);

  useEffect(() => {
    setName(project.name);
    setSlug(project.slug);
  }, [project.id, project.name, project.slug]);

  function onSave() {
    const nextName = name.trim();
    const nextSlug = slug.trim();
    if (!nextName) {
      toast.error("Project name is required");
      return;
    }
    if (!nextSlug) {
      toast.error("Slug is required");
      return;
    }
    if (nextName === project.name && nextSlug === project.slug) {
      toast.message("No changes to save");
      return;
    }
    startTransition(async () => {
      const r = await renameProjectAction(project.id, {
        name: nextName,
        slug: nextSlug,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setName(r.project.name);
      setSlug(r.project.slug);
      toast.success("Project updated");
      router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <label
        className="text-[13px] text-muted-foreground"
        htmlFor={`proj-name-${project.id}`}
      >
        Name
      </label>
      <SettingsInput
        id={`proj-name-${project.id}`}
        name="name"
        type="text"
        required
        maxLength={120}
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={pending}
      />
      <label
        className="text-[13px] text-muted-foreground"
        htmlFor={`proj-slug-${project.id}`}
      >
        Slug
      </label>
      <SettingsInput
        id={`proj-slug-${project.id}`}
        name="slug"
        type="text"
        required
        maxLength={120}
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        autoComplete="off"
        mono
        disabled={pending}
      />
      <SettingsBtn type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </SettingsBtn>
    </form>
  );
}

export function OrganizationProjectsSection({
  projects,
  canRename,
}: {
  projects: ProjectRow[];
  canRename: boolean;
}) {
  if (projects.length === 0) return null;

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
                <ProjectRenameForm project={p} />
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
