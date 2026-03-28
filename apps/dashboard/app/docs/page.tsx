import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/app/components/docs/CodeBlock";
import { DocsArticle } from "@/app/components/docs/DocsArticle";

export const metadata: Metadata = {
  title: "Getting Started — Docs — Telemetry Tracker",
  description: "What Telemetry Tracker is and how to send your first events",
};

const platforms = [
  {
    href: "/docs/nextjs",
    name: "Next.js",
    description:
      "Provider, error boundary, page tracking, and global browser error handlers.",
  },
  {
    href: "/docs/nuxt",
    name: "Nuxt",
    description: "Plugin + middleware using @tacko/telemetry-core.",
  },
  {
    href: "/docs/node",
    name: "Node.js",
    description: "Global error handlers, optional request middleware.",
  },
  {
    href: "/docs/react-native",
    name: "React Native",
    description: "Global error handler, session and screen tracking.",
  },
] as const;

const QUICK_START = `import { init } from "@tacko/telemetry-core";

init({
  ingestUrl: "https://your-api.example.com",
  app: "my-app",
});`;

export default function DocsPage() {
  return (
    <DocsArticle
      title="Getting Started"
      lede={
        <p>
          Add a few lines of code, point at your ingest URL, and start shipping errors, events, and
          sessions to the dashboard.
        </p>
      }
    >
      <section
        className="mb-10 rounded-xl border border-primary/35 bg-primary/10 p-6 shadow-sm"
        aria-labelledby="what-is-this-heading"
      >
        <h2 id="what-is-this-heading" className="mt-0 text-lg font-semibold tracking-tight text-foreground">
          What is this?
        </h2>
        <p className="mb-0 text-base leading-relaxed text-muted-foreground">
          <strong className="font-semibold text-foreground">Telemetry Tracker</strong> is a small,
          self-hostable pipeline for <strong className="font-semibold text-foreground">errors</strong>,{" "}
          <strong className="font-semibold text-foreground">product events</strong>, and{" "}
          <strong className="font-semibold text-foreground">sessions</strong>. You send JSON payloads
          from your apps via our SDKs; the API stores and aggregates them; the web dashboard is where
          you triage issues, scan trends, and drill into stacks and context—without running a full APM
          suite.
        </p>
      </section>

      <section className="mb-12" aria-labelledby="quick-start-heading">
        <h2 id="quick-start-heading" className="scroll-mt-24">
          Quick start
        </h2>
        <p className="text-muted-foreground">
          Install <code className="text-foreground">@tacko/telemetry-core</code> (or a platform package
          below). Replace <code className="text-foreground">ingestUrl</code> with your API base and{" "}
          <code className="text-foreground">app</code> with a logical name for filters in the UI. Use{" "}
          <strong className="text-foreground">Copy</strong> to paste into your project.
        </p>
        <CodeBlock caption="Minimal init" code={QUICK_START} lang="typescript" />
        <p className="text-sm text-muted-foreground">
          After <code className="text-foreground">init()</code>, browsers report uncaught errors and
          unhandled rejections automatically. See{" "}
          <Link href="/docs/sdk" className="text-link font-medium">
            SDK
          </Link>{" "}
          for <code className="text-foreground">trackEvent</code>, identity, batching, and the{" "}
          <code className="text-foreground">app</code> string.
        </p>
      </section>

      <section className="mb-12" aria-labelledby="how-it-works-heading">
        <h2 id="how-it-works-heading">How it fits together</h2>
        <ul className="mt-6 !list-none !pl-0 space-y-3">
          <li className="rounded-lg border border-border bg-surface/80 px-4 py-3 shadow-sm">
            <strong className="font-semibold text-foreground">Ingest</strong>
            <span className="text-muted-foreground">
              {" "}
              — Your services POST events, errors, and sessions to the API (e.g.{" "}
              <code>POST /ingest/event</code>).
            </span>
          </li>
          <li className="rounded-lg border border-border bg-surface/80 px-4 py-3 shadow-sm">
            <strong className="font-semibold text-foreground">SDKs</strong>
            <span className="text-muted-foreground">
              {" "}
              — Packages such as <code>@tacko/telemetry-next</code> and{" "}
              <code>@tacko/telemetry-core</code> handle init, batching, and sending.
            </span>
          </li>
          <li className="rounded-lg border border-border bg-surface/80 px-4 py-3 shadow-sm">
            <strong className="font-semibold text-foreground">Dashboard</strong>
            <span className="text-muted-foreground">
              {" "}
              — Overview, errors, events, and sessions with filters by app and time.{" "}
              <Link href="/docs/dashboard" className="text-link font-medium">
                Using the dashboard
              </Link>
              .
            </span>
          </li>
        </ul>
      </section>

      <section className="mb-12" aria-labelledby="platforms-heading">
        <h2 id="platforms-heading">Choose a platform</h2>
        <p className="text-muted-foreground">
          Same data model everywhere—pick the guide that matches your stack.
        </p>
        <ul className="mt-6 !list-none !pl-0 space-y-2">
          {platforms.map(({ href, name, description }) => (
            <li
              key={href}
              className="flex flex-col gap-1 rounded-lg border border-border/80 bg-background/50 py-3 pl-4 pr-4 sm:flex-row sm:items-baseline sm:gap-3"
            >
              <Link href={href} className="text-link shrink-0 font-semibold">
                {name}
              </Link>
              <span className="text-sm leading-relaxed text-muted-foreground">— {description}</span>
            </li>
          ))}
        </ul>
      </section>
    </DocsArticle>
  );
}
