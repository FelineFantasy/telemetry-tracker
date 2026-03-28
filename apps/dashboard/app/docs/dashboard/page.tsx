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
      <section className="mb-10" aria-labelledby="dash-open-heading">
        <h2 id="dash-open-heading">Open the app</h2>
        <p>
          <Link href="/dashboard/overview" className="text-link font-semibold">
            Open Dashboard
          </Link>{" "}
          — same host as these docs when self-hosted; sign-in depends on your deployment.
        </p>
      </section>

      <section className="mb-10" aria-labelledby="dash-overview-heading">
        <h2 id="dash-overview-heading">Overview</h2>
        <p>
          High-level counts and trends for the selected time range, plus top error groups and top
          event names. Use range tabs and the app filter to narrow scope.
        </p>
      </section>

      <section className="mb-10" aria-labelledby="dash-errors-heading">
        <h2 id="dash-errors-heading">Errors</h2>
        <p>
          Error groups are fingerprinted; each row shows occurrences, first/last seen, and trend. Open
          a group to read the message, stack traces, and recent occurrences with context JSON.
        </p>
      </section>

      <section className="mb-10" aria-labelledby="dash-events-heading">
        <h2 id="dash-events-heading">Events</h2>
        <p>
          Named analytics or product events with optional JSON properties. Filter by name, app,
          environment, platform, release, and time—then open a row for full detail.
        </p>
      </section>

      <section aria-labelledby="dash-sessions-heading">
        <h2 id="dash-sessions-heading">Sessions</h2>
        <p>
          Sessions group activity by session id and optional identity. Use the list to jump into a
          single session’s timeline and metadata.
        </p>
      </section>
    </DocsArticle>
  );
}
