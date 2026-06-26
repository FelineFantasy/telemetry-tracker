import type { Metadata } from "next";
import { CodeBlock } from "@/app/components/docs/CodeBlock";
import { DocsArticle } from "@/app/components/docs/DocsArticle";

export const metadata: Metadata = {
  title: "Nuxt — Docs — Telemetry Tracker",
  description: "Integrate Telemetry Tracker with Nuxt",
};

export default function DocsNuxtPage() {
  return (
    <DocsArticle
      title="Nuxt"
      lede={
        <p>
          Nuxt is Vue-based, so use <code>@tacko/telemetry-core</code> directly (there is no
          telemetry-nuxt package). Add a client plugin to init and a global middleware to track page
          views. After <code>init()</code>, uncaught errors and unhandled promise rejections in the
          browser are reported automatically.
        </p>
      }
    >
      <h2>Install</h2>
      <CodeBlock
        code={`pnpm add @tacko/telemetry-core
# or
npm install @tacko/telemetry-core`}
      />

      <h2>Runtime config</h2>
      <p>
        In <code>nuxt.config.ts</code> expose the ingest URL and app name:
      </p>
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
      <p>
        Create <code>plugins/telemetry.client.ts</code>:
      </p>
      <CodeBlock
        code={`import { init } from "@tacko/telemetry-core";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  init({
    ingestUrl: config.public.telemetryIngestUrl as string,
    app: config.public.telemetryApp as string,
    apiKey: config.public.telemetryApiKey as string,
    platform: "web",
    environment: process.dev ? "development" : "production",
  });
});`}
      />

      <h2>Page tracking</h2>
      <p>
        Create <code>middleware/telemetry.global.ts</code> to send a screen event on each route:
      </p>
      <CodeBlock
        code={`import { screen } from "@tacko/telemetry-core";

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.client) {
    screen(to.path || "/");
  }
});`}
      />

      <h2>Custom events and errors</h2>
      <CodeBlock
        code={`import { trackEvent, trackError } from "@tacko/telemetry-core";

trackEvent("button_click", { id: "submit" });
trackError(new Error("Something broke"), { page: "/checkout" });`}
      />

      <p>
        Core registers <code>window.onerror</code> and <code>unhandledrejection</code> after{" "}
        <code>init()</code>, so uncaught errors and promise rejections are reported automatically.
        Use <code>trackError()</code> in try/catch for extra context.
      </p>

      <h2>Optional: identify user</h2>
      <CodeBlock
        code={`import { identify } from "@tacko/telemetry-core";

identify(user.id);  // after login
identify(null);     // on logout`}
      />
    </DocsArticle>
  );
}
