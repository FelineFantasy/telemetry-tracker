import type { Metadata } from "next";
import { ContactEmailLink } from "@/app/components/legal/ContactEmailLink";
import { LegalArticle, LegalSection } from "@/app/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Telemetry Tracker handles data when you self-host the platform.",
};

export default function PrivacyPage() {
  return (
    <LegalArticle title="Privacy Policy" updated="June 28, 2026">
      <LegalSection id="overview" title="Overview" first>
        <p>
          Telemetry Tracker is self-hosted software. Your operator — you or your organization —
          controls what data is collected, how long it is retained, and who can access the
          dashboard.
        </p>
        <p>
          This policy describes the kinds of data the product can process when you run it. It does
          not replace your own privacy notices to your end users.
        </p>
      </LegalSection>

      <LegalSection id="data-collected" title="Data we help you collect">
        <p>
          SDKs send errors, events, and sessions to your configured ingest API. Payloads may
          include:
        </p>
        <ul>
          <li>Stack traces, error messages, and fingerprints</li>
          <li>Custom event names and properties you define</li>
          <li>Session start/end timestamps and identifiers</li>
          <li>User ids and anonymous device ids when you choose to attach them</li>
          <li>App name, SDK version, and environment metadata</li>
        </ul>
      </LegalSection>

      <LegalSection id="account-data" title="Account data">
        <p>
          Dashboard accounts store email addresses, hashed passwords, organization membership, and
          audit-relevant settings. Billing identifiers are stored when Stripe is configured.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="Retention and deletion">
        <p>
          Retention periods depend on your plan and retention job configuration. Because you host
          the database, you can delete projects, rotate API keys, and purge telemetry at any time.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Questions about privacy for a hosted deployment should be directed to your organization.
          For the open-source project, contact <ContactEmailLink />.
        </p>
      </LegalSection>
    </LegalArticle>
  );
}
