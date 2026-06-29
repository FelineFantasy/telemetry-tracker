import { cookies } from "next/headers";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  isCookieConsentChoice,
  preferenceCookiesAllowed,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";
import { TELEMETRY_ORG_COOKIE } from "@/lib/dashboard-org";
import { TELEMETRY_PROJECT_COOKIE } from "@/lib/dashboard-project";

const preferenceCookieBase = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

export async function getCookieConsentChoiceFromCookies(): Promise<CookieConsentChoice | null> {
  const value = (await cookies()).get(COOKIE_CONSENT_STORAGE_KEY)?.value;
  return isCookieConsentChoice(value) ? value : null;
}

export async function preferenceCookiesAllowedFromCookies(): Promise<boolean> {
  return preferenceCookiesAllowed(await getCookieConsentChoiceFromCookies());
}

export async function clearPreferenceCookies(): Promise<void> {
  const c = await cookies();
  c.set(TELEMETRY_ORG_COOKIE, "", { ...preferenceCookieBase, maxAge: 0 });
  c.set(TELEMETRY_PROJECT_COOKIE, "", { ...preferenceCookieBase, maxAge: 0 });
}
