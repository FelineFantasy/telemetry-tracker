/**
 * Merge updates into current query params for dashboard list pages.
 * Clears `page` so filter changes return to page 1.
 */
export function mergeListQuery(
  path: string,
  current: Record<string, string>,
  updates: Record<string, string | null | undefined>
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (v !== "") p.set(k, v);
  }
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || v === undefined || v === "") p.delete(k);
    else p.set(k, v);
  }
  if (!Object.prototype.hasOwnProperty.call(updates, "page")) {
    p.delete("page");
  }
  const q = p.toString();
  return q ? `${path}?${q}` : path;
}
