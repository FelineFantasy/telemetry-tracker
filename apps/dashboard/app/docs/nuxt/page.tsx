import { CodeBlock } from "../components/CodeBlock";

export const metadata = {
  title: "Nuxt — Docs — Telemetry Tracker",
  description: "Integrate Telemetry Tracker with Nuxt",
};

export default function DocsNuxtPage() {
  return (
    <>
      <h1>Nuxt</h1>
      <p>
        Nuxt is Vue-based, so use <code>telemetry-core</code> directly (there is
        no telemetry-nuxt package). Add a client plugin to init and a global
        middleware to track page views.
      </p>

      <h2>Install</h2>
      <CodeBlock code={`pnpm add telemetry-core
# or
npm install telemetry-core`} />

      <h2>Runtime config</h2>
      <p>In <code>nuxt.config.ts</code> expose the ingest URL and app name:</p>
      <CodeBlock
        code={`export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      telemetryIngestUrl: process.env.NUXT_PUBLIC_TELEMETRY_INGEST_URL || "https://your-api.example.com",
      telemetryApp: process.env.NUXT_PUBLIC_TELEMETRY_APP || "my-nuxt-app",
    },
  },
});`}
      />

      <h2>Plugin (client-only)</h2>
      <p>Create <code>plugins/telemetry.client.ts</code>:</p>
      <CodeBlock
        code={`import { init } from "telemetry-core";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  init({
    ingestUrl: config.public.telemetryIngestUrl as string,
    app: config.public.telemetryApp as string,
    platform: "web",
    environment: process.dev ? "development" : "production",
  });
});`}
      />

      <h2>Page tracking</h2>
      <p>Create <code>middleware/telemetry.global.ts</code> to send a screen event on each route:</p>
      <CodeBlock
        code={`import { screen } from "telemetry-core";

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.client) {
    screen(to.path || "/");
  }
});`}
      />

      <h2>Custom events and errors</h2>
      <CodeBlock
        code={`import { trackEvent, trackError } from "telemetry-core";

trackEvent("button_click", { id: "submit" });
trackError(new Error("Something broke"), { page: "/checkout" });`}
      />

      <p>
        For global errors, in your plugin you can set{" "}
        <code>window.onerror</code> and call <code>trackError()</code> with the
        error and context.
      </p>

      <h2>Optional: identify user</h2>
      <CodeBlock
        code={`import { identify } from "telemetry-core";

identify(user.id);  // after login
identify(null);     // on logout`}
      />
    </>
  );
}
