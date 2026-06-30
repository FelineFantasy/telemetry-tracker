/** Coalesce concurrent identical API loads (e.g. parallel Next.js RSC requests in dev). */
const inflight = new Map<string, Promise<unknown>>();

export function coalesceApiRequest<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = run().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

/** Coalesce overview fetches by full path + scope headers. */
export function coalesceOverviewRequest<T>(key: string, run: () => Promise<T>): Promise<T> {
  return coalesceApiRequest(`overview:${key}`, run);
}
