import type { Metadata } from "next";
import Link from "next/link";
import { DocsArticle } from "@/app/components/docs/DocsArticle";

export const metadata: Metadata = {
  title: "Dashboard — Docs — Telemetry Tracker",
  description: "Overview, errors, events, and sessions in the Telemetry Tracker UI",
};

export default function DocsDashboardPage() {
  return (
    <DocsArticle
      title="Using the dashboard"
      lede={
        <p>
          The web app is your control plane: filter by app and time, drill from trends into error
          groups, and inspect sessions end to end.
        </p>
      }
    >
      <section className="mb-10" aria-labelledby="dash-onboard-heading">
        <h2 id="dash-onboard-heading">Onboarding</h2>
        <ol className="list-decimal pl-5 text-muted-foreground space-y-2">
          <li>Register or sign in, then create an <strong className="text-foreground">organization</strong> and <strong className="text-foreground">project</strong> under Organization settings.</li>
          <li>Create an <strong className="text-foreground">API key</strong> (Settings → API keys). Copy the <code className="text-foreground">tt_live_…</code> secret once.</li>
          <li>
            In your app: <code className="text-foreground">init(&#123; ingestUrl, app, apiKey &#125;)</code> — see{" "}
            <Link href="/docs/sdk">SDK docs</Link>.
          </li>
          <li>Confirm data on Overview, Errors, Events, and Sessions.</li>
        </ol>
      </section>

      <section className="mb-10" aria-labelledby="dash-open-heading">
        <h2 id="dash-open-heading">Open the app</h2>
        <p>
          <Link href="/dashboard/overview" className="text-link font-semibold">
            Open Dashboard
          </Link>{" "}
          — same host as these docs when self-hosted; sign-in depends on your deployment.
        </p>
      </section>

      <section className="mb-10" aria-labelledby="dash-time-range-heading">
        <h2 id="dash-time-range-heading">Time range</h2>
        <p>
          Overview, Errors, Events, and Sessions share a <strong className="text-foreground">Time range</strong>{" "}
          picker. Leave it unselected to show the latest rows regardless of age (sorted and paginated).
          To narrow results, choose a preset, enter a custom relative window (for example{" "}
          <code className="text-foreground">2h</code> or <code className="text-foreground">8w</code>
          ), or pick an absolute <strong className="text-foreground">From</strong> /{" "}
          <strong className="text-foreground">To</strong> date range.
        </p>
        <p>
          Presets include 1 hour, 24 hours, 7 days, 14 days, 30 days, and 90 days. On{" "}
          <strong className="text-foreground">Overview</strong>, charts and key metrics follow the
          selected window; with no filter, metrics use a sensible default window for rates and
          comparisons.
        </p>
        <p>
          On <strong className="text-foreground">Issues</strong>, a separate{" "}
          <strong className="text-foreground">Trend window</strong> controls the recent vs prior
          period used for the trend column (same preset and custom options).
        </p>
      </section>

      <section className="mb-10" aria-labelledby="dash-overview-heading">
        <h2 id="dash-overview-heading">Overview</h2>
        <p>
          High-level counts and trends, plus top error groups and top event names. Use the time range
          picker and app/environment filters to narrow scope.
        </p>
      </section>

      <section className="mb-10" aria-labelledby="dash-errors-heading">
        <h2 id="dash-errors-heading">Errors</h2>
        <p>
          Error groups are fingerprinted; each row shows occurrences, first/last seen, and trend
          (based on the trend window). Open a group to read the message, stack traces, and recent
          occurrences with context JSON.
        </p>
      </section>

      <section className="mb-10" aria-labelledby="dash-events-heading">
        <h2 id="dash-events-heading">Events</h2>
        <p>
          Named analytics or product events with optional JSON properties. Filter by time range,
          name, app, environment, platform, and release—then open a row for full detail.
        </p>
      </section>

      <section aria-labelledby="dash-sessions-heading">
        <h2 id="dash-sessions-heading">Sessions</h2>
        <p>
          Sessions group activity by session id and optional identity. Filter by time range, then use
          the list to jump into a single session’s timeline and metadata.
        </p>
      </section>
    </DocsArticle>
  );
}
