export const COOKIE_CONSENT_STORAGE_KEY = "tt-cookie-consent";

export type CookieConsentChoice = "accepted" | "rejected";

export function isCookieConsentChoice(value: string | null): value is CookieConsentChoice {
  return value === "accepted" || value === "rejected";
}
