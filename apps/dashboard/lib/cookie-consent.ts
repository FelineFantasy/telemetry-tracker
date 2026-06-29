export const COOKIE_CONSENT_STORAGE_KEY = "tt-cookie-consent";

export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type CookieConsentChoice = "accepted" | "rejected";

export function isCookieConsentChoice(value: string | null): value is CookieConsentChoice {
  return value === "accepted" || value === "rejected";
}

export function preferenceCookiesAllowed(
  choice: CookieConsentChoice | null | undefined
): boolean {
  return choice === "accepted";
}

export function cookieConsentDocumentCookie(choice: CookieConsentChoice): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  return `${COOKIE_CONSENT_STORAGE_KEY}=${choice}; Path=/; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export const PREFERENCE_COOKIES_REQUIRED_MSG =
  "Accept cookies in the banner to save your workspace selection.";

export const PREFERENCE_COOKIES_REJECTED_MSG =
  "Optional cookies are off, so your workspace selection is not saved. Change preferences below to enable saving.";
