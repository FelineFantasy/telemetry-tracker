/** In-memory token bucket per project for plan `maxIngestRps` (single-process; sufficient for self-host v1). */
const buckets = new Map<string, { tokens: number; lastRefillMs: number }>();

export function consumeIngestRps(projectId: string, maxRps: number): boolean {
  if (!Number.isFinite(maxRps) || maxRps <= 0) return true;
  const now = Date.now();
  let bucket = buckets.get(projectId);
  if (!bucket) {
    bucket = { tokens: maxRps, lastRefillMs: now };
    buckets.set(projectId, bucket);
  }
  const elapsedSec = (now - bucket.lastRefillMs) / 1000;
  if (elapsedSec > 0) {
    bucket.tokens = Math.min(maxRps, bucket.tokens + elapsedSec * maxRps);
    bucket.lastRefillMs = now;
  }
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

/** Test helper */
export function resetIngestRpsBucketsForTests(): void {
  buckets.clear();
}
