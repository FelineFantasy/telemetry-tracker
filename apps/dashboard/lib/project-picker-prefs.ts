export type ProjectNavHealthStatus = "operational" | "degraded" | "outage" | "idle";

export type ProjectNavSummary = {
  projectId: string;
  status: ProjectNavHealthStatus;
  primaryEnvironment: string | null;
};

const PREFS_KEY = "tt_project_picker_v1";
const MAX_RECENT = 5;

type ProjectPickerPrefs = {
  pinned: string[];
  recent: string[];
};

function readPrefs(): ProjectPickerPrefs {
  if (typeof window === "undefined") return { pinned: [], recent: [] };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { pinned: [], recent: [] };
    const parsed = JSON.parse(raw) as Partial<ProjectPickerPrefs>;
    return {
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned.filter(Boolean) : [],
      recent: Array.isArray(parsed.recent) ? parsed.recent.filter(Boolean) : [],
    };
  } catch {
    return { pinned: [], recent: [] };
  }
}

function writePrefs(prefs: ProjectPickerPrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getProjectPickerPrefs(): ProjectPickerPrefs {
  return readPrefs();
}

export function togglePinnedProject(projectId: string): string[] {
  const prefs = readPrefs();
  const pinned = prefs.pinned.includes(projectId)
    ? prefs.pinned.filter((id) => id !== projectId)
    : [projectId, ...prefs.pinned];
  writePrefs({ ...prefs, pinned });
  return pinned;
}

export function recordRecentProject(projectId: string): string[] {
  const prefs = readPrefs();
  const recent = [projectId, ...prefs.recent.filter((id) => id !== projectId)].slice(
    0,
    MAX_RECENT
  );
  writePrefs({ ...prefs, recent });
  return recent;
}

export function projectNavSections(
  projects: readonly { id: string; name: string; slug: string }[],
  prefs: ProjectPickerPrefs,
  currentProjectId: string,
  query: string
): {
  pinned: string[];
  recent: string[];
  all: string[];
} {
  const q = query.trim().toLowerCase();
  const projectIds = new Set(projects.map((p) => p.id));
  const matches = (id: string) => {
    if (!projectIds.has(id)) return false;
    if (!q) return true;
    const project = projects.find((p) => p.id === id);
    if (!project) return false;
    const name = project.name.toLowerCase();
    const slug = project.slug.toLowerCase();
    return name.includes(q) || slug.includes(q);
  };

  const pinned = prefs.pinned.filter(matches);
  const pinnedSet = new Set(pinned);
  const recent = prefs.recent
    .filter((id) => id !== currentProjectId)
    .filter(matches)
    .filter((id) => !pinnedSet.has(id))
    .slice(0, MAX_RECENT);
  const recentSet = new Set(recent);
  const all = projects
    .map((p) => p.id)
    .filter(matches)
    .filter((id) => !pinnedSet.has(id) && !recentSet.has(id));

  return { pinned, recent, all };
}
