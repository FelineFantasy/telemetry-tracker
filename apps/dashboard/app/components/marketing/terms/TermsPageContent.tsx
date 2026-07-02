import Link from "next/link";
import type { ReactNode } from "react";
import { ContactEmailLink } from "@/app/components/legal/ContactEmailLink";
import { Footer } from "@/app/components/marketing/footer";
import { Nav } from "@/app/components/marketing/nav";
import { HOSTED_DASHBOARD_URL, HOSTED_OPERATOR } from "@/lib/hosted-cloud";

const EFFECTIVE = "July 2, 2026";
const VERSION = "2026.07";

type TermsSection = {
  id: string;
  title: string;
  body: ReactNode;
};

const sections: TermsSection[] = [
  {
    id: "agreement",
    title: "1. Agreement",
    body: (
      <>
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of Telemetry
          Tracker — the open-source observability platform, SDKs, dashboard, ingest API, and related
          documentation (collectively, the &quot;Service&quot;).
        </p>
        <p>
          By creating a dashboard account, installing an SDK, or otherwise using the Service, you
          accept these Terms. If you are entering into these Terms on behalf of a company or other
          legal entity, you represent that you have authority to bind that entity.
        </p>
        <p>
          The Service is available as <strong>open-source software you self-host</strong> and as an{" "}
          <strong>official hosted cloud</strong> operated by {HOSTED_OPERATOR} at{" "}
          <a href={HOSTED_DASHBOARD_URL} className="text-foreground/85 hover:text-foreground">
            telemetry-tracker.com
          </a>
          . The sections below apply to both unless a hosted-cloud provision says otherwise.
        </p>
      </>
    ),
  },
  {
    id: "hosted-cloud",
    title: "Official hosted cloud",
    body: (
      <>
        <p>
          When you use the managed service at{" "}
          <a href={HOSTED_DASHBOARD_URL} className="text-foreground/85 hover:text-foreground">
            {HOSTED_DASHBOARD_URL.replace("https://", "")}
          </a>{" "}
          (&quot;Hosted Cloud&quot;), {HOSTED_OPERATOR} operates the dashboard, API, and database on
          your behalf. You still own Customer Data you send through the Service; we process it to
          provide observability features described in the documentation.
        </p>
        <ul>
          <li>
            <strong className="text-foreground/85">Accounts & billing</strong> — registration,
            organizations, and paid plans (EUR via Stripe) are provided on the Hosted Cloud. Fees,
            taxes, and refunds follow the plan you select and applicable law.
          </li>
          <li>
            <strong className="text-foreground/85">Availability</strong> — we aim for reliable
            operation of the Hosted Cloud but do not guarantee uninterrupted service. Maintenance,
            incidents, and third-party outages may affect access. Self-hosted deployments remain
            your responsibility.
          </li>
          <li>
            <strong className="text-foreground/85">Support</strong> — contact{" "}
            <ContactEmailLink className="text-foreground/85 hover:text-foreground" /> or the{" "}
            <Link href="/contact" className="text-foreground/85 hover:text-foreground">
              contact page
            </Link>{" "}
            for Hosted Cloud account issues.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "accounts",
    title: "2. Accounts",
    body: (
      <>
        <p>
          You must provide accurate registration information and keep it current. You are
          responsible for all activity under your account, including activity by teammates you
          invite. Keep credentials, API keys, and project tokens confidential and rotate them
          promptly if compromise is suspected.
        </p>
        <p>
          The Service is not intended for individuals under 16. You may not create an account if
          you are prohibited from receiving services under the laws of your jurisdiction.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "3. Acceptable use",
    body: (
      <>
        <p>You agree not to, and not to permit any third party to:</p>
        <ul>
          <li>Use the Service to violate any law or third-party right;</li>
          <li>
            Send payment data, secrets, credentials, or unlawfully obtained personal data into
            events, breadcrumbs, or session payloads;
          </li>
          <li>
            Abuse ingest endpoints, probe systems without authorization, or attempt to gain access
            to data not belonging to you;
          </li>
          <li>
            Use the Service to transmit malware, spam, or other harmful or unlawful content;
          </li>
          <li>
            Misrepresent your identity or affiliation when contacting support or reporting security
            issues.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "customer-data",
    title: "4. Customer data",
    body: (
      <>
        <p>
          You retain all rights in the errors, events, sessions, attributes, and source maps you
          transmit through the Service (&quot;Customer Data&quot;). When you self-host, Customer Data
          is stored in infrastructure you control. You are solely responsible for Customer Data,
          including its legality and the notices you provide to your end users.
        </p>
        <p>
          You grant us a limited licence to process Customer Data only as needed to operate a
          dashboard or support channel you choose to use with us — for example, when you contact
          support and include reproduction details.
        </p>
      </>
    ),
  },
  {
    id: "subscriptions",
    title: "5. Plans & billing",
    body: (
      <>
        <p>
          Plan limits, retention windows, and feature gates are described in the project
          documentation. On the Hosted Cloud, paid plans are billed in advance in EUR via Stripe on
          the cycle you select. Usage above plan limits may be blocked according to plan
          enforcement.
        </p>
        <p>
          For self-hosted deployments, billing depends on how your operator configures Stripe and
          plan enforcement. Fees, taxes, and refund policies for a private deployment are set by
          your operator unless otherwise agreed in writing.
        </p>
      </>
    ),
  },
  {
    id: "service-levels",
    title: "6. Availability",
    body: (
      <>
        <p>
          When you self-host Telemetry Tracker, uptime, backups, and incident response are your
          responsibility. For the Hosted Cloud, {HOSTED_OPERATOR} manages infrastructure, backups,
          and retention jobs, but the Service is still provided as-is except where mandatory law
          applies.
        </p>
        <p>
          Community support is best-effort. Formal SLAs for the Hosted Cloud may be offered separately
          in writing for Business customers.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "7. Intellectual property",
    body: (
      <>
        <p>
          Telemetry Tracker is open-source software released under the MIT licence. You may use,
          modify, and distribute the codebase in accordance with that licence and its notices.
        </p>
        <p>
          Trademarks, logos, and documentation branding remain the property of their respective
          owners. You may submit feedback or suggestions; we may use such feedback without
          obligation.
        </p>
      </>
    ),
  },
  {
    id: "third-party",
    title: "8. Third-party services",
    body: (
      <>
        <p>
          The Service may interoperate with third-party platforms — for example source control,
          identity providers, or payment processors. Your use of those services is governed by their
          own terms. We are not responsible for third-party services and do not warrant their
          availability or behaviour.
        </p>
      </>
    ),
  },
  {
    id: "term-termination",
    title: "9. Term & termination",
    body: (
      <>
        <p>
          These Terms remain in effect while you use the Service. You may stop using the software
          and delete your dashboard account at any time. We may suspend or terminate access to any
          hosted dashboard we operate for material breach, abuse, or non-payment where billing
          applies.
        </p>
        <p>
          Upon termination, your right to access a hosted dashboard ends. Because self-hosted
          deployments store data locally, export and deletion are under your control.
        </p>
      </>
    ),
  },
  {
    id: "warranty",
    title: "10. Warranty disclaimer",
    body: (
      <>
        <p>
          To the maximum extent permitted by law, the Service is provided &quot;as is&quot; and
          &quot;as available&quot; without warranties of any kind, whether express, implied, or
          statutory, including merchantability, fitness for a particular purpose, and
          non-infringement. We do not warrant uninterrupted or error-free operation of self-hosted
          deployments or that the Service will detect every defect in your application.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    title: "11. Limitation of liability",
    body: (
      <>
        <p>
          To the maximum extent permitted by law, neither party will be liable for any indirect,
          incidental, special, consequential, or punitive damages, or for lost profits, revenues, or
          data, even if advised of the possibility of such damages. Our aggregate liability arising
          out of or related to these Terms will not exceed one hundred US dollars (US$100) or the
          fees you paid us in the twelve (12) months preceding the claim, whichever is greater.
        </p>
      </>
    ),
  },
  {
    id: "indemnification",
    title: "12. Indemnification",
    body: (
      <>
        <p>
          You will defend and indemnify us against any third-party claim arising from Customer Data
          or from your breach of these Terms, to the extent permitted by law.
        </p>
      </>
    ),
  },
  {
    id: "law",
    title: "13. Governing law",
    body: (
      <>
        <p>
          These Terms are governed by applicable law in your jurisdiction of use, without regard to
          conflict-of-laws rules. If a dispute cannot be resolved informally, the competent courts
          where the defendant is located will have exclusive jurisdiction, except that either party
          may seek injunctive relief in any court of competent jurisdiction.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "14. Changes to these Terms",
    body: (
      <>
        <p>
          We may update these Terms from time to time. Material changes will be reflected on this
          page with an updated effective date. Your continued use of the Service after changes take
          effect constitutes acceptance of the updated Terms.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "15. Contact",
    body: (
      <>
        <p>
          Questions about these Terms? Email <ContactEmailLink /> or use the{" "}
          <Link href="/contact" className="text-foreground underline-offset-4 hover:underline">
            contact page
          </Link>
          .
        </p>
      </>
    ),
  },
];

export function TermsPageContent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />

      <main id="main-content" className="pt-32">
        <section className="relative overflow-hidden border-b border-border">
          <div aria-hidden className="glow-blue absolute inset-0 opacity-50" />
          <div aria-hidden className="grid-bg absolute inset-0 opacity-[0.3]" />
          <div className="relative mx-auto max-w-6xl px-6 py-20">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Legal</p>
            <h1 className="mt-4 max-w-3xl text-balance text-5xl font-semibold tracking-tight md:text-6xl">
              Terms of Service
            </h1>
            <p className="mt-5 max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
              The rules of the road for using Telemetry Tracker. Written to be readable — if anything
              is unclear, ask us.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground">
              <span className="rounded-full border border-border bg-surface/70 px-3 py-1 backdrop-blur">
                Effective {EFFECTIVE}
              </span>
              <span className="rounded-full border border-border bg-surface/70 px-3 py-1 backdrop-blur">
                Version {VERSION}
              </span>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                On this page
              </p>
              <nav className="mt-4 space-y-1 border-l border-border">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="-ml-px block border-l border-transparent py-1 pl-4 text-sm text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </aside>

            <article className="max-w-2xl">
              <div className="rounded-2xl border border-border bg-surface/40 p-6 text-sm leading-relaxed text-muted-foreground">
                <p className="text-foreground">
                  <span className="font-medium">TL;DR.</span> Use Telemetry Tracker responsibly,
                  don&apos;t send secrets or personal data in payloads, and comply with applicable
                  law. Self-hosters operate their own infrastructure; Hosted Cloud users at{" "}
                  <a href={HOSTED_DASHBOARD_URL} className="underline-offset-4 hover:underline">
                    telemetry-tracker.com
                  </a>{" "}
                  contract with {HOSTED_OPERATOR} for the managed service. The full text below
                  controls.
                </p>
              </div>

              <div className="mt-12 space-y-14">
                {sections.map((s) => (
                  <section key={s.id} id={s.id} className="scroll-mt-28">
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                      {s.title}
                    </h2>
                    <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-muted-foreground [&_a]:text-foreground/85 [&_a:hover]:text-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
                      {s.body}
                    </div>
                  </section>
                ))}
              </div>

              <div className="mt-16 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface/40 p-6">
                <div>
                  <p className="text-sm font-medium text-foreground">Need help with deployment?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Self-hosting questions, security disclosures, and integration support.
                  </p>
                </div>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
                >
                  Contact us
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
