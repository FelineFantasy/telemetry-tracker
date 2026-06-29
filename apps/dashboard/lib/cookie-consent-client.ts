import {
  COOKIE_CONSENT_STORAGE_KEY,
  isCookieConsentChoice,
} from "@/lib/cookie-consent";

/** Include stored consent in server actions so bootstrap runs before the banner effect syncs. */
export function appendCookieConsentToFormData(formData: FormData): void {
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (isCookieConsentChoice(value)) {
      formData.set("cookieConsent", value);
    }
  } catch {
    /* ignore */
  }
}
