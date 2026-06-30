"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";
import { setDashboardProjectId } from "@/app/dashboard/actions";
import { hrefWithoutAppSearchParam } from "@/lib/dashboard-app-href";
import {
  formatProjectRailName,
  LEGACY_SEEDED_PROJECT_NAME,
} from "@/lib/workspace-placeholders";
import type { ProjectOption } from "@/lib/dashboard-workspace-types";
import { DashboardPopover } from "./DashboardPopover";
import { ORGANIZATION_SETTINGS_NEW_PROJECT_URL } from "@/app/components/OrganizationSettingsNewProjectParam";

export function TopNavProjectSwitcher({
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
  const [query, setQuery] = useState("");

  useEffect(() => {
    setValue(currentProjectId);
  }, [currentProjectId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)
    );
  }, [projects, query]);

  if (projects.length === 0) {
    return (
      <Link
        href={ORGANIZATION_SETTINGS_NEW_PROJECT_URL}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-sm hover:bg-surface"
      >
        Create project
      </Link>
    );
  }

  const current = projects.find((p) => p.id === value) ?? projects[0]!;
  const displayName = formatProjectRailName(current.name, current.slug);

  if (projects.length === 1) {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-sm"
        title={
          current.name === LEGACY_SEEDED_PROJECT_NAME
            ? "Default project from initial setup"
            : `${current.name} · ${current.slug}`
        }
      >
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <span>{displayName}</span>
      </div>
    );
  }

  return (
    <DashboardPopover
      width="w-80"
      trigger={(toggle, open) => (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-expanded={open}
          className="inline-flex max-w-[9rem] items-center gap-2 truncate rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-left text-sm hover:bg-surface sm:max-w-none"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span>{displayName}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {filtered.map((p) => {
              const name = formatProjectRailName(p.name, p.slug);
              const active = p.id === value;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setValue(p.id);
                    startTransition(async () => {
                      const r = await setDashboardProjectId(p.id);
                      if (r.ok) {
                        router.replace(hrefWithoutAppSearchParam(pathname, searchParams));
                        router.refresh();
                        close();
                      } else {
                        setValue(currentProjectId);
                      }
                    });
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  <span className="flex-1 text-left">{name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{p.slug}</span>
                  {active ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
              );
            })}
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">No projects match.</p>
            ) : null}
          </div>
          <div className="border-t border-border p-1.5">
            <Link
              href={ORGANIZATION_SETTINGS_NEW_PROJECT_URL}
              onClick={close}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Create new project
            </Link>
          </div>
        </div>
      )}
    </DashboardPopover>
  );
}
