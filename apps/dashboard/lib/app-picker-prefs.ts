const PREFS_KEY = "tt_app_picker_v1";
const MAX_RECENT = 5;

export type AppPickerPrefs = {
  pinned: string[];
  recent: string[];
};

type AppPickerStore = Record<string, AppPickerPrefs>;

function readStore(): AppPickerStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AppPickerStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: AppPickerStore) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

function emptyPrefs(): AppPickerPrefs {
  return { pinned: [], recent: [] };
}

export function getAppPickerPrefs(projectId: string): AppPickerPrefs {
  if (!projectId) return emptyPrefs();
  const store = readStore();
  const prefs = store[projectId];
  if (!prefs) return emptyPrefs();
  return {
    pinned: Array.isArray(prefs.pinned) ? prefs.pinned.filter(Boolean) : [],
    recent: Array.isArray(prefs.recent) ? prefs.recent.filter(Boolean) : [],
  };
}

function writePrefs(projectId: string, prefs: AppPickerPrefs) {
  if (!projectId) return;
  const store = readStore();
  store[projectId] = prefs;
  writeStore(store);
}

export function togglePinnedApp(projectId: string, app: string): string[] {
  const prefs = getAppPickerPrefs(projectId);
  const pinned = prefs.pinned.includes(app)
    ? prefs.pinned.filter((name) => name !== app)
    : [app, ...prefs.pinned];
  writePrefs(projectId, { ...prefs, pinned });
  return pinned;
}

export function recordRecentApp(projectId: string, app: string): string[] {
  const prefs = getAppPickerPrefs(projectId);
  const recent = [app, ...prefs.recent.filter((name) => name !== app)].slice(0, MAX_RECENT);
  writePrefs(projectId, { ...prefs, recent });
  return recent;
}

export function appNavSections(
  apps: readonly string[],
  prefs: AppPickerPrefs,
  currentApp: string,
  query: string
): {
  pinned: string[];
  recent: string[];
  all: string[];
} {
  const q = query.trim().toLowerCase();
  const appSet = new Set(apps);
  const matches = (app: string) => {
    if (!appSet.has(app)) return false;
    if (!q) return true;
    return app.toLowerCase().includes(q);
  };

  const pinned = prefs.pinned.filter(matches);
  const pinnedSet = new Set(pinned);
  const recent = prefs.recent
    .filter((app) => app !== currentApp)
    .filter(matches)
    .filter((app) => !pinnedSet.has(app))
    .slice(0, MAX_RECENT);
  const recentSet = new Set(recent);
  const all = apps.filter(matches).filter((app) => !pinnedSet.has(app) && !recentSet.has(app));

  return { pinned, recent, all };
}
