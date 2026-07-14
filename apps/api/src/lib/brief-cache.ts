import {
  BRIEF_CACHE_MAX_ENTRIES,
  BRIEF_CACHE_TTL_MS,
  BRIEF_RESPONSE_SCHEMA_VERSION,
} from "./brief-constants.js";
import type { BriefSnapshotRequest, ProjectBrief, WorkspaceBriefResponse } from "./brief-contracts.js";

export type BriefCacheSemanticProject = Omit<ProjectBrief, "generatedThrough">;

export type BriefCacheEntry = {
  contentHash: string;
  presentationHash: string;
  responseSchemaVersion: typeof BRIEF_RESPONSE_SCHEMA_VERSION;
  workspace: { title: string; subtitle?: string };
  projects: BriefCacheSemanticProject[];
  cachedAt: number;
};

export type BriefCacheKey = {
  organizationId: string;
  contentHash: string;
  presentationHash: string;
  responseSchemaVersion: typeof BRIEF_RESPONSE_SCHEMA_VERSION;
};

function cacheKeyString(key: BriefCacheKey): string {
  return `${key.organizationId}:${key.contentHash}:${key.presentationHash}:${key.responseSchemaVersion}`;
}

export class BriefSemanticCache {
  private readonly entries = new Map<string, BriefCacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(options?: { ttlMs?: number; maxEntries?: number }) {
    this.ttlMs = options?.ttlMs ?? BRIEF_CACHE_TTL_MS;
    this.maxEntries = options?.maxEntries ?? BRIEF_CACHE_MAX_ENTRIES;
  }

  private pruneExpired(now = Date.now()): void {
    for (const [key, entry] of this.entries) {
      if (now - entry.cachedAt > this.ttlMs) {
        this.entries.delete(key);
      }
    }
  }

  private evictOldest(now = Date.now()): void {
    let oldestKey: string | null = null;
    let oldestAt = Number.POSITIVE_INFINITY;
    for (const [key, entry] of this.entries) {
      if (entry.cachedAt < oldestAt) {
        oldestAt = entry.cachedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) this.entries.delete(oldestKey);
    this.pruneExpired(now);
  }

  get(key: BriefCacheKey, now = Date.now()): BriefCacheEntry | null {
    this.pruneExpired(now);
    const entry = this.entries.get(cacheKeyString(key));
    if (!entry) return null;
    if (now - entry.cachedAt > this.ttlMs) {
      this.entries.delete(cacheKeyString(key));
      return null;
    }
    return entry;
  }

  put(key: BriefCacheKey, entry: Omit<BriefCacheEntry, "cachedAt">, now = Date.now()): void {
    this.pruneExpired(now);
    while (this.entries.size >= this.maxEntries) {
      this.evictOldest(now);
      if (this.entries.size >= this.maxEntries) break;
    }
    this.entries.set(cacheKeyString(key), { ...entry, cachedAt: now });
  }

  evict(key: BriefCacheKey): void {
    this.entries.delete(cacheKeyString(key));
  }

  /** @internal */
  size(): number {
    return this.entries.size;
  }

  /** @internal Test helper */
  clear(): void {
    this.entries.clear();
  }
}

/** Rebind cached semantic output to the current request snapshot. */
export function rebindCachedBriefResponse(
  snapshot: BriefSnapshotRequest,
  entry: BriefCacheEntry,
  requestId: string,
  generatedAt: Date
): WorkspaceBriefResponse {
  return {
    schemaVersion: BRIEF_RESPONSE_SCHEMA_VERSION,
    requestId,
    generatedAt: generatedAt.toISOString(),
    workspace: entry.workspace,
    projects: entry.projects.map((project) => {
      const snapshotProject = snapshot.projects.find((p) => p.projectId === project.projectId);
      if (!snapshotProject) {
        throw new Error(`Cached project ${project.projectId} missing from snapshot`);
      }
      return {
        ...project,
        generatedThrough: snapshotProject.window.until,
      };
    }),
  };
}

export const briefSemanticCache = new BriefSemanticCache();

/** @internal Test helper */
export function resetBriefSemanticCache(): void {
  briefSemanticCache.clear();
}
