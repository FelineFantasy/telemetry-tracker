import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="landing">
      <div className="landing__content">
        <h1 className="landing__title">Telemetry Tracker</h1>
        <p className="landing__tagline">
          Internal telemetry: errors, events, and sessions from your apps.
        </p>
        <nav className="landing__nav" aria-label="Get started">
          <Link href="/dashboard" className="landing__cta">
            Open dashboard
          </Link>
          <Link href="/docs" className="landing__link">
            Docs
          </Link>
        </nav>
      </div>
    </div>
  );
}
