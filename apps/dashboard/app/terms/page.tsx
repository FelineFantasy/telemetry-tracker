import type { Metadata } from "next";
import { LegalPageShell, LegalSection } from "@/app/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using Telemetry Tracker self-hosted observability software.",
};

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" updated="June 28, 2026">
      <LegalSection title="Agreement">
        <p>
          By creating an account or using Telemetry Tracker, you agree to these terms. If you are
          using the software on behalf of an organization, you represent that you have authority to
          bind that organization.
        </p>
      </LegalSection>

      <LegalSection title="The service">
        <p>
          Telemetry Tracker is provided as self-hosted open-source software for error, event, and
          session observability. Features, plan limits, retention windows, and billing (when Stripe
          is configured) are described in the project documentation and may change between releases.
        </p>
      </LegalSection>

      <LegalSection title="Your responsibilities">
        <p>You are responsible for:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Operating the API, database, and dashboard securely</li>
          <li>Complying with applicable law and your own policies toward end users</li>
          <li>Managing access to organizations, projects, and API keys</li>
          <li>Not using the service to transmit unlawful content or abuse ingest endpoints</li>
        </ul>
      </LegalSection>

      <LegalSection title="Disclaimer">
        <p>
          The software is provided without warranty of any kind, express or implied. We do not
          guarantee uninterrupted or error-free operation of self-hosted deployments.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms:{" "}
          <a href="mailto:info@tacko.io" className="text-brand hover:underline">
            info@tacko.io
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  );
}
