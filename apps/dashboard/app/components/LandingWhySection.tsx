import type { CSSProperties } from "react";

const pillars = [
  {
    title: "Simpler than Sentry",
    body: "Errors, events, and sessions—without enterprise pricing tiers, endless settings, or a week of setup.",
  },
  {
    title: "One SDK for every platform",
    body: "Same init, same payloads for web, mobile, and backend. Ship once, observe everywhere.",
  },
  {
    title: "Self-host friendly",
    body: "Run the API and dashboard where you want. Your data stays on your infrastructure.",
  },
  {
    title: "Built for small teams",
    body: "Opinionated defaults and a calm UI—so you fix incidents, not configure observability full-time.",
  },
] as const;

const themes = [
  "Cross-platform simplicity",
  "Ultra-lightweight SDK",
  "Self-host first",
] as const;

export function LandingWhySection() {
  return (
    <section
      id="why"
      className="landing-why landing-animate-section"
      aria-labelledby="landing-why-title"
    >
      <div className="landing-why__inner">
        <header className="landing-why__header">
          <p className="landing-kicker landing-kicker--why">Why us</p>
          <h2 id="landing-why-title" className="landing-why__title">
            Why Telemetry Tracker?
          </h2>
          <p className="landing-why__lede">
            <strong className="landing-why__lede-strong">Cross-platform simplicity</strong>
            <span className="landing-why__lede-dot" aria-hidden>
              {" "}
              ·{" "}
            </span>
            <strong className="landing-why__lede-strong">Ultra-lightweight SDK</strong>
            <span className="landing-why__lede-dot" aria-hidden>
              {" "}
              ·{" "}
            </span>
            <strong className="landing-why__lede-strong">Self-host first</strong>
            <span className="landing-why__lede-rest">
              {" "}
              — three ideas that drive everything below.
            </span>
          </p>
          <ul className="landing-why__themes" aria-label="Core themes">
            {themes.map((t) => (
              <li key={t} className="landing-why__theme-pill">
                {t}
              </li>
            ))}
          </ul>
        </header>

        <ul className="landing-why__grid">
          {pillars.map((p, i) => (
            <li
              key={p.title}
              className="landing-why__card"
              style={{ "--landing-i": i } as CSSProperties}
            >
              <h3 className="landing-why__card-title">{p.title}</h3>
              <p className="landing-why__card-body">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
