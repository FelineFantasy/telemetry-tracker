import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 prose prose-invert">
      <h1>Privacy Policy</h1>
      <p>
        Telemetry Tracker is self-hosted software. Your operator (you or your organization) controls
        what data is collected, how long it is retained, and who can access the dashboard.
      </p>
      <p>
        SDKs send errors, events, and sessions to your configured ingest API. Payloads may include
        user ids, anonymous device ids, stack traces, and custom properties you choose to attach.
      </p>
      <p>
        <Link href="/">Back to home</Link>
      </p>
    </main>
  );
}
