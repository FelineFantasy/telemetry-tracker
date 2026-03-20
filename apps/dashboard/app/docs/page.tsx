import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/app/components/docs/CodeBlock";
import { DocsArticle } from "@/app/components/docs/DocsArticle";

export const metadata: Metadata = {
  title: "Docs — Telemetry Tracker",
  description: "Integrate Telemetry Tracker with your app",
};

const platforms = [
  {
    href: "/docs/nextjs",
    name: "Next.js",
    description:
      "Provider, error boundary, page tracking, and (via core) global browser error/rejection handlers.",
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

export default function DocsPage() {
  return (
    <DocsArticle
      title="Introduction"
      lede={
        <p>
          Telemetry Tracker is a lightweight telemetry backend for errors, events, and sessions.
          Send data from your apps via SDKs, then explore it in the dashboard.
        </p>
      }
    >
      <section className="mb-12" aria-labelledby="how-it-works-heading">
        <h2 id="how-it-works-heading">How it works</h2>
        <ul className="mt-6 !list-none !pl-0 space-y-3">
          <li className="rounded-lg border border-border bg-surface/80 px-4 py-3 shadow-sm">
            <strong className="font-semibold text-foreground">Ingest API</strong>
            <span className="text-muted-foreground">
              {" "}
              — Your app sends events, errors, and sessions to the API (e.g.{" "}
              <code>POST /ingest/event</code>).
            </span>
          </li>
          <li className="rounded-lg border border-border bg-surface/80 px-4 py-3 shadow-sm">
            <strong className="font-semibold text-foreground">SDKs</strong>
            <span className="text-muted-foreground">
              {" "}
              — Platform-specific packages (<code>@tacko/telemetry-next</code>,{" "}
              <code>@tacko/telemetry-node</code>, etc.) or the core library (
              <code>@tacko/telemetry-core</code>) handle init, batching, and sending.
            </span>
          </li>
          <li className="rounded-lg border border-border bg-surface/80 px-4 py-3 shadow-sm">
            <strong className="font-semibold text-foreground">Dashboard</strong>
            <span className="text-muted-foreground">
              {" "}
              — Overview, errors, events, and sessions with filters by app and time range.
            </span>
          </li>
        </ul>
      </section>

      <section className="mb-12" aria-labelledby="quick-start-heading">
        <h2 id="quick-start-heading">Quick start (any platform)</h2>
        <p>
          Install <code>@tacko/telemetry-core</code> (or the platform package), then call{" "}
          <code>init()</code> with your ingest URL and app name. In the browser, uncaught errors and
          unhandled promise rejections are reported automatically after <code>init()</code>. Data
          appears in the dashboard under that app name.
        </p>
        <CodeBlock
          code={`import { init, trackEvent, trackError, screen, identify } from "@tacko/telemetry-core";

init({
  ingestUrl: "https://your-api.example.com",
  app: "my-app",
});

trackEvent("button_click", { id: "submit" });
trackError(new Error("Something broke"), { page: "/checkout" });
screen("/home");
identify("user-123");`}
        />
      </section>

      <section className="mb-12" aria-labelledby="platforms-heading">
        <h2 id="platforms-heading">Platforms</h2>
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

      <section className="mb-12" aria-labelledby="identity-heading">
        <h2 id="identity-heading">Identity and anonymous ID</h2>
        <p>
          The SDK generates a stable anonymous device id on first <code>init()</code> and sends it
          (and the SDK version) with every event, error, and session. When you call{" "}
          <code>identify(userId)</code>, the same anonymous id is still sent so the backend can link
          pre-login activity to the user. In the dashboard, a single <strong>Identity</strong> column
          shows the user id when set, otherwise the anonymous id.
        </p>
      </section>

      <section aria-labelledby="app-name-heading">
        <h2 id="app-name-heading">App name</h2>
        <p>
          The <code>app</code> value is a string that identifies your application in the dashboard.
          You don’t register apps in the UI; once you send at least one event or error with an app
          name, it appears in the dashboard filters and data.
        </p>
      </section>
    </DocsArticle>
  );
}
