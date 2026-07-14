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

/** Display identity — user_id takes precedence; blank user_id falls back to anonymous_id. */
export function resolveSessionIdentityLabel(
  userId: string | null | undefined,
  anonymousId: string | null | undefined
): string | null {
  const uid = userId?.trim();
  if (uid) return uid;
  const aid = anonymousId?.trim();
  if (aid) return aid;
  return null;
}
