"use server";

import { clearPreferenceCookies } from "@/lib/cookie-consent-server";

export async function clearPreferenceCookiesAction(): Promise<void> {
  await clearPreferenceCookies();
}
