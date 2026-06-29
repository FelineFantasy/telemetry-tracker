import {
  COOKIE_CONSENT_STORAGE_KEY,
  cookieConsentDocumentCookie,
  isCookieConsentChoice,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";

/** Keep document.cookie and localStorage aligned with the authoritative server choice. */
export function syncClientCookieConsentStorage(choice: CookieConsentChoice): void {
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);
  document.cookie = cookieConsentDocumentCookie(choice);
}

/** Only pre-fill auth when the server has not recorded consent yet. */
export function appendCookieConsentToFormData(
  formData: FormData,
  serverChoice: CookieConsentChoice | null
): void {
  if (serverChoice) return;
  try {
    const value = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (isCookieConsentChoice(value)) {
      formData.set("cookieConsent", value);
    }
  } catch {
    /* ignore */
  }
}
