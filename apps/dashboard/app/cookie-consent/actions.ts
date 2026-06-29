"use server";

import {
  clearPreferenceCookies,
  restoreCookieConsentChoiceIfUnset,
  setCookieConsentChoice,
} from "@/lib/cookie-consent-server";
import { isCookieConsentChoice, type CookieConsentChoice } from "@/lib/cookie-consent";

export async function clearPreferenceCookiesAction(): Promise<void> {
  await clearPreferenceCookies();
}

/** Explicit banner choice — always updates the server consent cookie. */
export async function syncCookieConsentAction(
  choice: CookieConsentChoice
): Promise<void> {
  if (!isCookieConsentChoice(choice)) return;
  await setCookieConsentChoice(choice);
  if (choice === "rejected") {
    await clearPreferenceCookies();
  }
}

/** Restore localStorage consent on the server only when no prior server choice exists. */
export async function restoreCookieConsentAction(
  choice: CookieConsentChoice
): Promise<void> {
  if (!isCookieConsentChoice(choice)) return;
  const restored = await restoreCookieConsentChoiceIfUnset(choice);
  if (restored && choice === "rejected") {
    await clearPreferenceCookies();
  }
}
