/** ISO 3166-1 alpha-2 country code to regional indicator flag emoji. */
export function countryFlagEmoji(code: string | null | undefined): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return null;
  return [...normalized].map((ch) => String.fromCodePoint(127397 + ch.charCodeAt(0))).join("");
}

export function formatSessionDevice(
  browser: string | null | undefined,
  os: string | null | undefined
): string | null {
  const parts = [browser?.trim(), os?.trim()].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : null;
}
