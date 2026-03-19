/**
 * Next.js page `searchParams` values can be `string | string[] | undefined`.
 * Use this when reading a single-value query param (e.g. `?app=my-app`).
 */
export function firstQueryValue(
  value: string | string[] | undefined
): string | undefined {
  if (value === undefined) return undefined;
  const s = Array.isArray(value) ? value[0] : value;
  return s === "" ? undefined : s;
}

export function serializeSearchParams(
  input: Record<string, string | string[] | undefined>
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.set(key, value);
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}
