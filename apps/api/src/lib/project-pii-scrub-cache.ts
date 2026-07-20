/**
 * Cached load of project PII scrub settings for the ingest hot path.
 * Failures never block ingest: return defaults and keep default scrubbing.
 */

import type { PrismaClient } from "@prisma/client";
import {
  DEFAULT_PROJECT_PII_SCRUB_SETTINGS,
  parseProjectPiiScrubSettings,
  type ProjectPiiScrubSettings,
} from "./project-pii-scrub-settings.js";

const CACHE_TTL_MS = 60_000;

type CacheEntry = { at: number; settings: ProjectPiiScrubSettings };

const cache = new Map<string, CacheEntry>();

export function clearProjectPiiScrubSettingsCache(projectId?: string): void {
  if (projectId) cache.delete(projectId);
  else cache.clear();
}

/** Test helper: inspect cache keys (does not expose values across projects). */
export function projectPiiScrubCacheHas(projectId: string): boolean {
  return cache.has(projectId);
}

export async function loadProjectPiiScrubSettings(
  prisma: PrismaClient,
  projectId: string,
  now = Date.now()
): Promise<ProjectPiiScrubSettings> {
  const hit = cache.get(projectId);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    return hit.settings;
  }
  try {
    const row = await prisma.project.findFirst({
      where: { id: projectId, deleted_at: null },
      select: { pii_scrub_settings: true },
    });
    const settings = parseProjectPiiScrubSettings(row?.pii_scrub_settings ?? null);
    cache.set(projectId, { at: now, settings });
    return settings;
  } catch (err) {
    console.warn(
      "[ingest] failed to load project PII scrub settings; using default scrubber only",
      { projectId, err }
    );
    // Do not cache failures — next request can retry. Keep ingest scrubbing defaults.
    return DEFAULT_PROJECT_PII_SCRUB_SETTINGS;
  }
}

/** Deny-keys only (event/error ingest). */
export async function loadProjectPiiDenyKeys(
  prisma: PrismaClient,
  projectId: string,
  now = Date.now()
): Promise<string[]> {
  const settings = await loadProjectPiiScrubSettings(prisma, projectId, now);
  return settings.denyKeys;
}
