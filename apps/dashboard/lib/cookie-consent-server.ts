import { cookies } from "next/headers";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  PREFERENCE_COOKIES_REJECTED_MSG,
  PREFERENCE_COOKIES_REQUIRED_MSG,
  isCookieConsentChoice,
  preferenceCookiesAllowed,
  type CookieConsentChoice,
} from "@/lib/cookie-consent";
import { TELEMETRY_ORG_COOKIE } from "@/lib/dashboard-org";
import { TELEMETRY_PROJECT_COOKIE } from "@/lib/dashboard-project";

const UUID_RE = /^[0-9a-f-]{36}$/i;

const preferenceCookieBase = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

async function readDashboardProjectCookieValue(): Promise<string | undefined> {
  const v = (await cookies()).get(TELEMETRY_PROJECT_COOKIE)?.value?.trim();
  if (v && UUID_RE.test(v)) return v.toLowerCase();
  return undefined;
}

async function readDashboardOrganizationCookieValue(): Promise<string | undefined> {
  const v = (await cookies()).get(TELEMETRY_ORG_COOKIE)?.value?.trim();
  if (v && UUID_RE.test(v)) return v.toLowerCase();
  return undefined;
}

export async function getCookieConsentChoiceFromCookies(): Promise<CookieConsentChoice | null> {
  const value = (await cookies()).get(COOKIE_CONSENT_STORAGE_KEY)?.value;
  return isCookieConsentChoice(value) ? value : null;
}

export async function preferenceCookiesAllowedFromCookies(): Promise<boolean> {
  return preferenceCookiesAllowed(await getCookieConsentChoiceFromCookies());
}

export async function preferenceCookiesDeniedMessage(): Promise<string> {
  const choice = await getCookieConsentChoiceFromCookies();
  if (choice === "rejected") return PREFERENCE_COOKIES_REJECTED_MSG;
  return PREFERENCE_COOKIES_REQUIRED_MSG;
}

export async function getAllowedDashboardProjectCookie(): Promise<string | undefined> {
  if (!(await preferenceCookiesAllowedFromCookies())) return undefined;
  return readDashboardProjectCookieValue();
}

export async function getAllowedDashboardOrganizationCookie(): Promise<string | undefined> {
  if (!(await preferenceCookiesAllowedFromCookies())) return undefined;
  return readDashboardOrganizationCookieValue();
}

export async function clearPreferenceCookies(): Promise<void> {
  const c = await cookies();
  c.set(TELEMETRY_ORG_COOKIE, "", { ...preferenceCookieBase, maxAge: 0 });
  c.set(TELEMETRY_PROJECT_COOKIE, "", { ...preferenceCookieBase, maxAge: 0 });
}
