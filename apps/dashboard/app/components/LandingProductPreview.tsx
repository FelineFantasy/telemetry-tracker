/**
 * Decorative “screenshots”: CSS-only mock dashboard chrome + blurred content (no real data).
 */
export function LandingProductPreview() {
  return (
    <section
      id="preview"
      className="landing-preview landing-animate-section"
      aria-labelledby="landing-preview-title"
    >
      <div className="landing-preview__inner">
        <header className="landing-preview__header">
          <p className="landing-kicker">Inside the product</p>
          <h2 id="landing-preview-title" className="landing-section-title">
            A calm dashboard for noisy production data
          </h2>
          <p className="landing-preview__lede">
            Drill from high-level trends into error groups, stack traces, and sessions—without leaving
            one consistent UI. The views below are illustrative mocks (blurred), not live telemetry.
          </p>
        </header>

        <div className="landing-preview__grid">
          <figure className="landing-mock">
            <div className="landing-mock__chrome" aria-hidden>
              <span className="landing-mock__dots">
                <span />
                <span />
                <span />
              </span>
              <span className="landing-mock__url">app / Overview</span>
            </div>
            <div className="landing-mock__frame">
              <div className="landing-mock__blur" aria-hidden>
                <div className="landing-mock__sidebar">
                  <span className="landing-mock__nav-pill landing-mock__nav-pill--active" />
                  <span className="landing-mock__nav-pill" />
                  <span className="landing-mock__nav-pill" />
                  <span className="landing-mock__nav-pill" />
                </div>
                <div className="landing-mock__main">
                  <div className="landing-mock__chart">
                    <span className="landing-mock__chart-line" />
                    <span className="landing-mock__chart-area" />
                  </div>
                  <div className="landing-mock__rows">
                    <span className="landing-mock__row" />
                    <span className="landing-mock__row landing-mock__row--short" />
                    <span className="landing-mock__row" />
                  </div>
                </div>
              </div>
            </div>
            <figcaption className="landing-mock__caption">
              Overview — trends, deltas, and top error groups at a glance
            </figcaption>
          </figure>

          <figure className="landing-mock">
            <div className="landing-mock__chrome" aria-hidden>
              <span className="landing-mock__dots">
                <span />
                <span />
                <span />
              </span>
              <span className="landing-mock__url">errors / Group detail</span>
            </div>
            <div className="landing-mock__frame">
              <div className="landing-mock__blur landing-mock__blur--detail" aria-hidden>
                <div className="landing-mock__detail-head">
                  <span className="landing-mock__pill" />
                  <span className="landing-mock__pill landing-mock__pill--muted" />
                </div>
                <div className="landing-mock__stack">
                  <span className="landing-mock__stack-line" />
                  <span className="landing-mock__stack-line" />
                  <span className="landing-mock__stack-line landing-mock__stack-line--dim" />
                  <span className="landing-mock__stack-line" />
                </div>
                <div className="landing-mock__ctx">
                  <span className="landing-mock__ctx-row" />
                  <span className="landing-mock__ctx-row landing-mock__ctx-row--short" />
                </div>
              </div>
            </div>
            <figcaption className="landing-mock__caption">
              Error detail — stack trace and context, formatted for scanning
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
