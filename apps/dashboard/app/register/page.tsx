import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterPageForm } from "@/app/components/auth/RegisterPageForm";

export const metadata: Metadata = {
  title: "Create account",
  description:
    "Create a Telemetry Tracker account and start tracking errors, events, and sessions in minutes.",
  robots: { index: false, follow: true },
};

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageForm />
    </Suspense>
  );
}
