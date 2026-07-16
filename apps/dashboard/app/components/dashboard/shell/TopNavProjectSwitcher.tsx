"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Pin, Plus, Search } from "lucide-react";
import { setDashboardProjectId } from "@/app/dashboard/actions";
import { hrefWithoutAppSearchParam } from "@/lib/dashboard-app-href";
import type { ProjectNavSummary } from "@/lib/project-nav-summary-types";
import {
  getProjectPickerPrefs,
  projectNavSections,
  recordRecentProject,
  togglePinnedProject,
} from "@/lib/project-picker-prefs";
import {
  formatProjectRailName,
  LEGACY_SEEDED_PROJECT_NAME,
} from "@/lib/workspace-placeholders";
import type { ProjectOption } from "@/lib/dashboard-workspace-types";
import { searchInputClassName } from "@/lib/input-classes";
import { useDashboardNavigation } from "@/lib/use-dashboard-navigation";
import { cn } from "@/lib/utils";
import { DashboardPopover, ShellKbd } from "./DashboardPopover";
import { NavPickerSection } from "./NavPickerSection";
import { ProjectStatusDot } from "./ProjectStatusDot";
import { NavPickerTrigger } from "./shell-primitives";
import { ORGANIZATION_SETTINGS_NEW_PROJECT_URL } from "@/app/components/OrganizationSettingsNewProjectParam";

const IDLE_SUMMARY: ProjectNavSummary = {
  projectId: "",
  status: "idle",
  primaryEnvironment: null,
};

export function TopNavProjectSwitcher({
  projects,
  currentProjectId,
  projectNavSummaries,
}: {
  projects: ProjectOption[];
  currentProjectId: string;
  projectNavSummaries: Record<string, ProjectNavSummary>;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const { replace, runPending, isPending: pending } = useDashboardNavigation();
  const [value, setValue] = useState(currentProjectId);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(getProjectPickerPrefs);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(currentProjectId);
  }, [currentProjectId]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && document.activeElement !== searchRef.current) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const sections = useMemo(
    () => projectNavSections(projects, prefs, value, query),
    [prefs, projects, query, value]
  );

  const summaryFor = useCallback(
    (projectId: string): ProjectNavSummary =>
      projectNavSummaries[projectId] ?? { ...IDLE_SUMMARY, projectId },
    [projectNavSummaries]
  );

  const selectProject = useCallback(
    (projectId: string, close: () => void) => {
      if (projectId === value) {
        close();
        return;
      }
      setValue(projectId);
      void runPending(async () => {
        const r = await setDashboardProjectId(projectId);
        if (r.ok) {
          setPrefs({ ...prefs, recent: recordRecentProject(projectId) });
          replace(hrefWithoutAppSearchParam(pathname, searchParams));
          router.refresh();
          close();
        } else {
          setValue(currentProjectId);
        }
      });
    },
    [currentProjectId, pathname, prefs, replace, router, runPending, searchParams, value]
  );

  const onTogglePin = useCallback(
    (event: React.MouseEvent, projectId: string) => {
      event.preventDefault();
      event.stopPropagation();
      const pinned = togglePinnedProject(projectId);
      setPrefs({ ...prefs, pinned });
    },
    [prefs]
  );

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
  const currentSummary = summaryFor(current.id);

  return (
    <DashboardPopover
      width="w-80"
      onOpenChange={setOpen}
      trigger={(toggle, isOpen) => (
        <NavPickerTrigger
          onClick={toggle}
          disabled={pending}
          aria-expanded={isOpen}
          aria-label="Project"
        >
          <ProjectStatusDot status={currentSummary.status} />
          <span className="truncate">{displayName}</span>
          <ChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
        </NavPickerTrigger>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className={`w-full ${searchInputClassName}`}
            />
            <ShellKbd>/</ShellKbd>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {sections.pinned.length > 0 ? (
              <NavPickerSection title="Pinned">
                {sections.pinned.map((id) => (
                  <ProjectPickerRow
                    key={`pinned-${id}`}
                    project={projects.find((p) => p.id === id)!}
                    active={id === value}
                    pinned
                    pending={pending}
                    summary={summaryFor(id)}
                    onSelect={() => selectProject(id, close)}
                    onTogglePin={(e) => onTogglePin(e, id)}
                  />
                ))}
              </NavPickerSection>
            ) : null}

            {sections.recent.length > 0 ? (
              <NavPickerSection title="Recent">
                {sections.recent.map((id) => (
                  <ProjectPickerRow
                    key={`recent-${id}`}
                    project={projects.find((p) => p.id === id)!}
                    active={id === value}
                    pinned={prefs.pinned.includes(id)}
                    pending={pending}
                    summary={summaryFor(id)}
                    onSelect={() => selectProject(id, close)}
                    onTogglePin={(e) => onTogglePin(e, id)}
                  />
                ))}
              </NavPickerSection>
            ) : null}

            {sections.all.length > 0 ? (
              <NavPickerSection title="All projects">
                {sections.all.map((id) => (
                  <ProjectPickerRow
                    key={`all-${id}`}
                    project={projects.find((p) => p.id === id)!}
                    active={id === value}
                    pinned={prefs.pinned.includes(id)}
                    pending={pending}
                    summary={summaryFor(id)}
                    onSelect={() => selectProject(id, close)}
                    onTogglePin={(e) => onTogglePin(e, id)}
                  />
                ))}
              </NavPickerSection>
            ) : null}

            {sections.pinned.length === 0 &&
            sections.recent.length === 0 &&
            sections.all.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No projects match.
              </p>
            ) : null}

            {current.name === LEGACY_SEEDED_PROJECT_NAME && current.slug === "default" ? (
              <p className="px-4 pb-2 text-[12px] text-muted-foreground">
                <Link
                  href="/dashboard/settings/organization"
                  onClick={close}
                  className="text-brand hover:underline"
                >
                  Rename this project
                </Link>
              </p>
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

function ProjectPickerRow({
  project,
  active,
  pinned,
  pending,
  summary,
  onSelect,
  onTogglePin,
}: {
  project: ProjectOption;
  active: boolean;
  pinned: boolean;
  pending: boolean;
  summary: ProjectNavSummary;
  onSelect: () => void;
  onTogglePin: (event: React.MouseEvent) => void;
}) {
  const name = formatProjectRailName(project.name, project.slug);
  const envLabel = summary.primaryEnvironment;

  return (
    <div className="group flex items-center rounded-md pr-1 hover:bg-surface">
      <button
        type="button"
        disabled={pending}
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm"
      >
        <ProjectStatusDot status={summary.status} />
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {envLabel ? (
          <span className="hidden max-w-[5.5rem] truncate font-mono text-[10px] uppercase text-muted-foreground sm:inline">
            {envLabel}
          </span>
        ) : null}
        {active ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
      </button>
      <button
        type="button"
        aria-label={pinned ? "Unpin project" : "Pin project"}
        title={pinned ? "Unpin" : "Pin"}
        onClick={onTogglePin}
        className={cn(
          "rounded p-1 text-muted-foreground hover:text-foreground",
          pinned ? "opacity-100 text-brand" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <Pin className={cn("h-3 w-3", pinned && "fill-current")} />
      </button>
    </div>
  );
}
