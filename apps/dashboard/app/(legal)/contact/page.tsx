import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmailLink } from "@/app/components/legal/ContactEmailLink";
import { LegalArticle, LegalSection } from "@/app/components/legal/LegalPageShell";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Telemetry Tracker team for support, sales, and security reports.",
};

export default function ContactPage() {
  return (
    <LegalArticle title="Contact us" eyebrow="Company">
      <LegalSection id="overview" title="Get in touch" first>
        <p>
          Telemetry Tracker is built by a small engineering team. Whether you are self-hosting,
          evaluating the platform, or need help with a hosted deployment, we are happy to hear from
          you.
        </p>
        <p>
          For product questions, billing on Business plans, or partnership inquiries, email us
          directly. For bugs and feature ideas, GitHub issues are the fastest path.
        </p>
      </LegalSection>

      <LegalSection id="email" title="Email">
        <p>
          General inquiries, Business plan pricing, and dedicated support: <ContactEmailLink />
        </p>
        <p className="text-muted-foreground">
          We typically respond within one business day. Include your organization name and deployment
          type (self-hosted or hosted) if relevant.
        </p>
      </LegalSection>

      <LegalSection id="community" title="Community & docs">
        <p>
          Open-source users can browse the{" "}
          <Link href="/docs" className="text-brand hover:underline">
            documentation
          </Link>
          , search existing discussions, or open an issue on GitHub.
        </p>
        <ul>
          <li>
            <a
              href="https://github.com/Telemetry-Tracker/telemetry-tracker/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              GitHub issues
            </a>{" "}
            — bugs, feature requests, and questions about the codebase
          </li>
          <li>
            <a
              href="https://github.com/Telemetry-Tracker/telemetry-tracker"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              Repository
            </a>{" "}
            — source, deployment guides, and contribution guidelines
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="security" title="Security">
        <p>
          If you believe you have found a security vulnerability, please do not open a public issue.
          Report it responsibly through GitHub private security advisories or contact us by email so
          we can coordinate a fix before disclosure.
        </p>
        <p>
          See{" "}
          <a
            href="https://github.com/Telemetry-Tracker/telemetry-tracker/security/policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline"
          >
            SECURITY.md
          </a>{" "}
          in the repository for scope and reporting steps.
        </p>
      </LegalSection>
    </LegalArticle>
  );
}
