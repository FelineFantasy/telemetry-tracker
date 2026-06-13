import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 prose prose-invert">
      <h1>Terms of Service</h1>
      <p>
        Telemetry Tracker is provided as self-hosted open-source software without warranty. You are
        responsible for operating the API, database, and dashboard in compliance with your policies
        and applicable law.
      </p>
      <p>
        Plan limits, retention, and billing (when Stripe is configured) are described in the
        project documentation.
      </p>
      <p>
        <Link href="/">Back to home</Link>
      </p>
    </main>
  );
}
