/**
 * URL query helpers for list pagination (`?page=`, `?pageSize=`).
 * API defaults: page 1, pageSize 20 (max 100). Overview lists use `listPageSize` (default 10).
 */

export const DEFAULT_LIST_PAGE_SIZE = 20;
export const MAX_LIST_PAGE_SIZE = 100;
export const OVERVIEW_LIST_PAGE_SIZE = 10;
export const MAX_OVERVIEW_LIST_PAGE_SIZE = 50;

export function parseOverviewListPageSize(
  value: string | string[] | undefined
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Math.floor(Number(raw));
  const v = Number.isFinite(n) && n >= 1 ? n : OVERVIEW_LIST_PAGE_SIZE;
  return Math.min(MAX_OVERVIEW_LIST_PAGE_SIZE, Math.max(1, v));
}

/** Prefer API `total`; coerce numbers; fall back to current page `items.length` when total is absent. */
export function resolveApiListTotal(
  totalFromApi: unknown,
  itemsLength: number
): number {
  if (typeof totalFromApi === "number" && Number.isFinite(totalFromApi)) {
    return Math.max(0, Math.floor(totalFromApi));
  }
  if (totalFromApi != null && totalFromApi !== "") {
    const n = Number(totalFromApi);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return itemsLength;
}

export function parsePageParam(value: string | string[] | undefined, fallback = 1): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

/** Reads `pageSize` or legacy `limit`. */
export function parsePageSizeParam(
  pageSize: string | string[] | undefined,
  limit: string | string[] | undefined,
  fallback = DEFAULT_LIST_PAGE_SIZE
): number {
  const raw = first(pageSize) ?? first(limit);
  const n = Math.floor(Number(raw));
  const v = Number.isFinite(n) && n >= 1 ? n : fallback;
  return Math.min(MAX_LIST_PAGE_SIZE, Math.max(1, v));
}

function first(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  return s === "" ? undefined : s;
}
