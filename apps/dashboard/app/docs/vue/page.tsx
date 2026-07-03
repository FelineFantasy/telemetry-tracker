import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/app/components/docs/CodeBlock";
import { DocsArticle } from "@/app/components/docs/DocsArticle";

export const metadata: Metadata = {
  title: "Vue — Docs — Telemetry Tracker",
  description: "Integrate Telemetry Tracker with Vue 3 and vue-router",
};

export default function DocsVuePage() {
  return (
    <DocsArticle
      title="Vue"
      lede={
        <p>
          Use <code>@telemetry-tracker/core</code> in Vue 3 SPAs (Vite, webpack, or similar). Call{" "}
          <code>init()</code> once at app startup and hook <code>router.afterEach</code> for page
          views. After <code>init()</code>, uncaught errors and unhandled promise rejections in the
          browser are reported automatically. For Nuxt, see the{" "}
          <Link href="/docs/nuxt" className="text-brand hover:underline">
            Nuxt guide
          </Link>
          .
        </p>
      }
    >
      <h2>Install</h2>
      <CodeBlock
        code={`pnpm add @telemetry-tracker/core
# or
npm install @telemetry-tracker/core`}
      />

      <h2>Environment (Vite)</h2>
      <p>
        Add to <code>.env</code> (prefix public vars with <code>VITE_</code>):
      </p>
      <CodeBlock
        code={`VITE_TELEMETRY_INGEST_URL=https://your-api.example.com
VITE_TELEMETRY_APP=my-vue-app
VITE_TELEMETRY_API_KEY=tt_live_<publicId>_<secret>`}
      />

      <h2>Setup in main.ts</h2>
      <p>
        Initialize before mounting the app, then track route changes with{" "}
        <code>screen()</code>:
      </p>
      <CodeBlock
        code={`import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { init, screen } from "@telemetry-tracker/core";

init({
  ingestUrl: import.meta.env.VITE_TELEMETRY_INGEST_URL,
  app: import.meta.env.VITE_TELEMETRY_APP ?? "my-vue-app",
  apiKey: import.meta.env.VITE_TELEMETRY_API_KEY,
  platform: "web",
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
});

router.afterEach((to) => {
  screen(to.fullPath || "/");
});

createApp(App).use(router).mount("#app");`}
      />

      <h2>Optional: plugin</h2>
      <p>
        Wrap init in a plugin if you prefer dependency-injection style setup:
      </p>
      <CodeBlock
        code={`// plugins/telemetry.ts
import type { App } from "vue";
import { init, type TelemetryConfig } from "@telemetry-tracker/core";

export function telemetryPlugin(config: TelemetryConfig) {
  return {
    install(_app: App) {
      init(config);
    },
  };
}

// main.ts
import { telemetryPlugin } from "./plugins/telemetry";

app.use(
  telemetryPlugin({
    ingestUrl: import.meta.env.VITE_TELEMETRY_INGEST_URL,
    app: "my-vue-app",
    apiKey: import.meta.env.VITE_TELEMETRY_API_KEY,
  })
);`}
      />

      <h2>Custom events and errors</h2>
      <CodeBlock
        code={`import { trackEvent, trackError, identify } from "@telemetry-tracker/core";

trackEvent("button_click", { id: "submit" });
trackError(new Error("Checkout failed"), { step: "payment" });
identify(user.id);  // after login`}
      />

      <p>
        Use <code>trackError()</code> in component <code>onErrorCaptured</code> or Pinia action
        catch blocks when you want extra context beyond the global handlers.
      </p>
    </DocsArticle>
  );
}
