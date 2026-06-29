import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPageForm } from "@/app/components/auth/LoginPageForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Telemetry Tracker account to view errors, events, and sessions.",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageForm />
    </Suspense>
  );
}
