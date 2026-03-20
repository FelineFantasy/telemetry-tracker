import type { CSSProperties } from "react";
import Link from "next/link";
import { LandingHeader } from "@/app/components/LandingHeader";

function IconErrors() {
  return (
    <svg className="landing-feature__icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 9v3.5M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconEvents() {
  return (
    <svg className="landing-feature__icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSessions() {
  return (
    <svg className="landing-feature__icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M12 6v6l4 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSdk() {
  return (
    <svg className="landing-feature__icon-svg" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 18l6-6-6-6M8 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const features = [
  {
    title: "Error groups",
    body: "Fingerprints, stacks, and recent occurrences—grouped so regressions stand out.",
    icon: IconErrors,
    accent: "teal" as const,
  },
  {
    title: "Events & screens",
    body: "Custom events and navigation with properties you define, scoped per app.",
    icon: IconEvents,
    accent: "violet" as const,
  },
  {
    title: "Sessions",
    body: "Trace anonymous and identified sessions from first touch to logout.",
    icon: IconSessions,
    accent: "amber" as const,
  },
  {
    title: "SDK-ready",
    body: "Web, Next.js, Node, and React Native—one ingest, consistent payloads.",
    icon: IconSdk,
    accent: "rose" as const,
  },
] as const;

const steps = [
  {
    n: "01",
    title: "Instrument",
    body: "Add the SDK, call init once, and start sending errors and events from your stack.",
  },
  {
    n: "02",
    title: "Ingest",
    body: "Payloads land in your API—batched where it makes sense, with anonymous id and SDK version.",
  },
  {
    n: "03",
    title: "Explore",
    body: "Use the dashboard to filter by app, drill into groups, and inspect sessions end to end.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="landing-shell">
      <LandingHeader />
      <main id="main-content" className="landing-page">
        <section id="hero" className="landing-hero" aria-labelledby="landing-hero-title">
          <div className="landing-hero__mesh" aria-hidden />
          <div className="landing-hero__glow landing-hero__glow--teal" aria-hidden />
          <div className="landing-hero__glow landing-hero__glow--violet" aria-hidden />
          <div className="landing-hero__inner">
            <p className="landing-hero__highlight-strap">
              Lightweight telemetry for modern apps
            </p>
            <h1 id="landing-hero-title" className="landing-hero__title">
              <span className="landing-hero__title-line">
                Track errors, events and sessions across all your apps
              </span>{" "}
              <span className="landing-hero__title-sdk">— with one SDK</span>
            </h1>
            <p className="landing-hero__lede">
              Stop juggling ad-hoc logs and one-off dashboards. Telemetry Tracker gives your team a
              single view across clients and services—so you can ship with confidence.
            </p>
            <div className="landing-hero__actions">
              <Link href="/dashboard/overview" className="landing-btn landing-btn--accent">
                Open dashboard
              </Link>
              <Link href="/docs" className="landing-btn landing-btn--ghost-light">
                Documentation
              </Link>
            </div>
            <p className="landing-hero__note">
              Self-hosted friendly · Scoped SDKs · Anonymous + identified users
            </p>
          </div>
        </section>

        <section
          id="features"
          className="landing-features landing-animate-section"
          aria-labelledby="landing-features-title"
        >
          <div className="landing-features__inner">
            <div className="landing-features__header">
              <p className="landing-kicker">Capabilities</p>
              <h2 id="landing-features-title" className="landing-section-title">
                Everything you need to observe production
              </h2>
              <p className="landing-section-sub">
                Built for teams who care about signal over noise—clear grouping, fast scanning, and
                room to go deep when something breaks.
              </p>
            </div>
            <ul className="landing-feature-grid">
              {features.map(({ title, body, icon: Icon, accent }, i) => (
                <li
                  key={title}
                  className={`landing-feature landing-feature--${accent}`}
                  style={{ "--landing-i": i } as CSSProperties}
                >
                  <div className="landing-feature__icon" aria-hidden>
                    <Icon />
                  </div>
                  <h3 className="landing-feature__title">{title}</h3>
                  <p className="landing-feature__body">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="workflow"
          className="landing-workflow landing-animate-section"
          aria-labelledby="landing-workflow-title"
        >
          <div className="landing-workflow__inner">
            <div className="landing-workflow__intro">
              <p className="landing-kicker landing-kicker--dark">How it works</p>
              <h2 id="landing-workflow-title" className="landing-section-title">
                From code to clarity in three steps
              </h2>
            </div>
            <ol className="landing-steps">
              {steps.map((step, i) => (
                <li
                  key={step.n}
                  className="landing-step"
                  style={{ "--landing-i": i } as CSSProperties}
                >
                  <span className="landing-step__num">{step.n}</span>
                  <div>
                    <h3 className="landing-step__title">{step.title}</h3>
                    <p className="landing-step__body">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-band landing-animate-section" aria-labelledby="landing-band-title">
          <div className="landing-band__inner">
            <h2 id="landing-band-title" className="landing-band__title">
              Ready to dig into your data?
            </h2>
            <p className="landing-band__text">
              The dashboard is live—filter by app, browse error groups, and inspect events and
              sessions in one flow.
            </p>
            <Link href="/dashboard/overview" className="landing-btn landing-btn--on-accent">
              Go to overview
            </Link>
          </div>
        </section>

        <section
          id="contact"
          className="landing-contact landing-animate-section"
          aria-labelledby="landing-contact-title"
        >
          <div className="landing-contact__inner">
            <div className="landing-contact__card">
              <p className="landing-kicker">Contact</p>
              <h2 id="landing-contact-title" className="landing-section-title">
                Questions or feedback?
              </h2>
              <p className="landing-contact__lede">
                Whether you’re integrating the SDK or planning a rollout, we’re happy to hear from
                you. Reach out by email or start from the docs.
              </p>
              <div className="landing-contact__actions">
                <a href="mailto:info@tacko.io" className="landing-btn landing-btn--accent">
                  info@tacko.io
                </a>
                <Link href="/docs" className="landing-btn landing-btn--outline-dark">
                  Browse docs
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <div className="landing-footer__brand">
            <span className="landing-footer__name">Telemetry Tracker</span>
            <p className="landing-footer__tagline">
              Internal telemetry for errors, events, and sessions.
            </p>
          </div>
          <div className="landing-footer__cols">
            <div className="landing-footer__col">
              <h3 className="landing-footer__heading">Product</h3>
              <ul className="landing-footer__list">
                <li>
                  <Link href="/dashboard/overview">Dashboard</Link>
                </li>
                <li>
                  <Link href="/docs">Documentation</Link>
                </li>
              </ul>
            </div>
            <div className="landing-footer__col">
              <h3 className="landing-footer__heading">Sections</h3>
              <ul className="landing-footer__list">
                <li>
                  <a href="#features">Features</a>
                </li>
                <li>
                  <a href="#workflow">How it works</a>
                </li>
                <li>
                  <a href="#contact">Contact</a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="landing-footer__bottom">
          <p className="landing-footer__copy">© {new Date().getFullYear()} Telemetry Tracker</p>
        </div>
      </footer>
    </div>
  );
}
