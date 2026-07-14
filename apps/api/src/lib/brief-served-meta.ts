/**
 * In-memory served-brief metadata for acknowledgement validation.
 *
 * Key: userId:organizationId:requestId
 * Retains up to BRIEF_SERVED_META_MAX_PER_USER_ORG entries per user/org (LRU by servedAt).
 *
 * Multi-instance limitation: metadata is per API process.
 */

import {
  BRIEF_SERVED_META_MAX_PER_USER_ORG,
  BRIEF_SERVED_META_TTL_MS,
} from "./brief-constants.js";

export type ServedBriefSource = "ai" | "cache" | "fallback";

export type ServedBriefMeta = {
  requestId: string;
  snapshotHash: string;
  organizationId: string;
  source: ServedBriefSource;
  projects: Array<{
    projectId: string;
    generatedThrough: string;
  }>;
  servedAt: number;
};

export type StoreServedBriefMetaInput = Omit<ServedBriefMeta, "servedAt">;

function metaKey(userId: string, organizationId: string, requestId: string): string {
  return `${userId}:${organizationId}:${requestId}`;
}

function userOrgPrefix(userId: string, organizationId: string): string {
  return `${userId}:${organizationId}:`;
}

export class BriefServedMetaStore {
  private readonly entries = new Map<string, ServedBriefMeta>();
  private readonly ttlMs: number;
  private readonly maxPerUserOrg: number;

  constructor(options?: { ttlMs?: number; maxPerUserOrg?: number }) {
    this.ttlMs = options?.ttlMs ?? BRIEF_SERVED_META_TTL_MS;
    this.maxPerUserOrg = options?.maxPerUserOrg ?? BRIEF_SERVED_META_MAX_PER_USER_ORG;
  }

  private isExpired(entry: ServedBriefMeta, now: number): boolean {
    return now - entry.servedAt > this.ttlMs;
  }

  private pruneExpired(now = Date.now()): void {
    for (const [key, entry] of this.entries) {
      if (this.isExpired(entry, now)) {
        this.entries.delete(key);
      }
    }
  }

  private enforcePerUserOrgCap(userId: string, organizationId: string, now: number): void {
    const prefix = userOrgPrefix(userId, organizationId);
    const scoped = [...this.entries.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, entry]) => ({ key, entry }))
      .sort((a, b) => b.entry.servedAt - a.entry.servedAt);

    for (let i = this.maxPerUserOrg; i < scoped.length; i += 1) {
      this.entries.delete(scoped[i]!.key);
    }

    // Re-run expiry after cap eviction
    this.pruneExpired(now);
  }

  /** Persist metadata for a served brief (AI, cache, or fallback). */
  store(userId: string, input: StoreServedBriefMetaInput, now = Date.now()): ServedBriefMeta {
    this.pruneExpired(now);
    const entry: ServedBriefMeta = { ...input, servedAt: now };
    this.entries.set(metaKey(userId, input.organizationId, input.requestId), entry);
    this.enforcePerUserOrgCap(userId, input.organizationId, now);
    return entry;
  }

  /** Load metadata for an exact served request. */
  get(
    userId: string,
    organizationId: string,
    requestId: string,
    now = Date.now()
  ): ServedBriefMeta | null {
    this.pruneExpired(now);
    const entry = this.entries.get(metaKey(userId, organizationId, requestId));
    if (!entry || this.isExpired(entry, now)) {
      if (entry) this.entries.delete(metaKey(userId, organizationId, requestId));
      return null;
    }
    return entry;
  }

  /** List non-expired served entries for a user/org (newest first). */
  listForUserOrg(userId: string, organizationId: string, now = Date.now()): ServedBriefMeta[] {
    this.pruneExpired(now);
    const prefix = userOrgPrefix(userId, organizationId);
    return [...this.entries.entries()]
      .filter(([key, entry]) => key.startsWith(prefix) && !this.isExpired(entry, now))
      .map(([, entry]) => entry)
      .sort((a, b) => b.servedAt - a.servedAt);
  }

  /** @internal Test helper */
  size(): number {
    return this.entries.size;
  }
}

/** Process-wide served-meta store (Phase 3A foundation). */
export const briefServedMetaStore = new BriefServedMetaStore();
