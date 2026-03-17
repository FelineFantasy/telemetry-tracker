import { CodeBlock } from "./components/CodeBlock";

export const metadata = {
  title: "Docs — Telemetry Tracker",
  description: "Integrate Telemetry Tracker with your app",
};

export default function DocsPage() {
  return (
    <>
      <h1>Introduction</h1>
      <p>
        Telemetry Tracker is a lightweight telemetry backend for errors, events,
        and sessions. Send data from your apps via SDKs, then view it in the
        dashboard.
      </p>

      <h2>How it works</h2>
      <ul>
        <li>
          <strong>Ingest API</strong> — Your app sends events, errors, and
          sessions to the API (e.g. <code>POST /ingest/event</code>).
        </li>
        <li>
          <strong>SDKs</strong> — Platform-specific packages (<code>@tacko/telemetry-next</code>,{" "}
          <code>@tacko/telemetry-node</code>, etc.) or the core library (
          <code>@tacko/telemetry-core</code>) handle init, batching, and sending.
        </li>
        <li>
          <strong>Dashboard</strong> — Overview, errors, events, and sessions
          with filters by app and time range.
        </li>
      </ul>

      <h2>Quick start (any platform)</h2>
      <p>
        Install <code>@tacko/telemetry-core</code> (or the platform package), then call{" "}
        <code>init()</code> with your ingest URL and app name. In the browser, uncaught errors and unhandled promise rejections are reported automatically after <code>init()</code>. Data appears in the dashboard under that app name.
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

      <h2>Platforms</h2>
      <ul>
        <li>
          <a href="/docs/nextjs" className="anchor">Next.js</a> — Provider, error boundary, page tracking, and (via core) global browser error/rejection handlers.
        </li>
        <li>
          <a href="/docs/nuxt" className="anchor">Nuxt</a> — Plugin + middleware using <code>@tacko/telemetry-core</code>.
        </li>
        <li>
          <a href="/docs/node" className="anchor">Node.js</a> — Global error handlers, optional request middleware.
        </li>
        <li>
          <a href="/docs/react-native" className="anchor">React Native</a> — Global error handler, session and screen tracking.
        </li>
      </ul>

      <h2>App name</h2>
      <p>
        The <code>app</code> value is a string that identifies your application
        in the dashboard. You don’t register apps in the UI; once you send at
        least one event or error with an app name, it appears in the dashboard
        filters and data.
      </p>
    </>
  );
}
