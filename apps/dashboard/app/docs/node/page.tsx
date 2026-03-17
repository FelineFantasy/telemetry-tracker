import { CodeBlock } from "../components/CodeBlock";

export const metadata = {
  title: "Node.js — Docs — Telemetry Tracker",
  description: "Integrate Telemetry Tracker with Node.js",
};

export default function DocsNodePage() {
  return (
    <>
      <h1>Node.js</h1>
      <p>
        Use the <code>telemetry-node</code> package for Node.js servers. It
        wraps <code>telemetry-core</code> and installs global handlers for{" "}
        <code>uncaughtException</code> and <code>unhandledRejection</code>. You
        can also attach a request middleware to track HTTP requests.
      </p>

      <h2>Install</h2>
      <CodeBlock code={`pnpm add telemetry-node
# or
npm install telemetry-node`} />

      <h2>Setup</h2>
      <p>Call <code>init()</code> as early as possible (e.g. at the top of your entry file):</p>
      <CodeBlock
        code={`import { init, trackEvent, trackError } from "telemetry-node";

init({
  ingestUrl: process.env.TELEMETRY_INGEST_URL || "https://your-api.example.com",
  app: "my-api",
  platform: "node",
});

trackEvent("server_started", { version: "1.0.0" });
trackError(new Error("DB connection failed"), { db: "primary" });`}
      />

      <h2>Global error handlers</h2>
      <p>
        After <code>init()</code>, <code>uncaughtException</code> and{" "}
        <code>unhandledRejection</code> are patched to send errors to the ingest
        API (and then rethrow / continue so your process can still exit or log
        as usual).
      </p>

      <h2>Request middleware</h2>
      <p>
        Optional: use <code>middleware()</code> to send a <code>$request</code> event per
        HTTP request (method, url, duration). Attach it to your server framework
        (Express, Fastify, etc.) so it runs for each request.
      </p>
      <CodeBlock
        code={`import { middleware } from "telemetry-node";

const telemetryMiddleware = middleware({ trackRequestBody: false });

// Express-style
app.use((req, res, next) => {
  telemetryMiddleware(req, res, () => {
    next();
  });
});

// Or call next() and then track when response finishes — adapt to your framework.`}
      />

      <p>
        The middleware tracks <code>method</code>, <code>url</code>, and{" "}
        <code>duration_ms</code>. Set <code>trackRequestBody: true</code> to
        include the request body in the event (use with care for PII/size).
      </p>
    </>
  );
}
