import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPageForm } from "@/app/components/auth/LoginPageForm";
import { getCookieConsentChoiceFromCookies } from "@/lib/cookie-consent-server";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Telemetry Tracker account to view errors, events, and sessions.",
  robots: { index: false, follow: true },
};

export default async function LoginPage() {
  const serverChoice = await getCookieConsentChoiceFromCookies();
  return (
    <Suspense fallback={null}>
      <LoginPageForm serverChoice={serverChoice} />
    </Suspense>
  );
}
