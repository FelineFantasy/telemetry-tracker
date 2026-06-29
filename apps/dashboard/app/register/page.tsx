import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterPageForm } from "@/app/components/auth/RegisterPageForm";
import { getCookieConsentChoiceFromCookies } from "@/lib/cookie-consent-server";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create a Telemetry Tracker account and start tracking errors, events, and sessions in minutes.",
  robots: { index: false, follow: true },
};

export default async function RegisterPage() {
  const serverChoice = await getCookieConsentChoiceFromCookies();
  return (
    <Suspense fallback={null}>
      <RegisterPageForm serverChoice={serverChoice} />
    </Suspense>
  );
}
