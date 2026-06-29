"use server";

import {
  clearPreferenceCookies,
  setCookieConsentChoice,
} from "@/lib/cookie-consent-server";
import { isCookieConsentChoice, type CookieConsentChoice } from "@/lib/cookie-consent";

export async function clearPreferenceCookiesAction(): Promise<void> {
  await clearPreferenceCookies();
}

export async function syncCookieConsentAction(
  choice: CookieConsentChoice
): Promise<void> {
  if (!isCookieConsentChoice(choice)) return;
  await setCookieConsentChoice(choice);
  if (choice === "rejected") {
    await clearPreferenceCookies();
  }
}
