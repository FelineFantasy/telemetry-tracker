# Nuxt

Nuxt integration via `@telemetry-tracker/core` (Vue-based; no dedicated `@telemetry-tracker/nuxt` package). For standalone Vue SPAs, see [sdk-vue.md](sdk-vue.md).

## Install

```bash
pnpm add @telemetry-tracker/core
```

## Runtime config

In `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      telemetryIngestUrl: process.env.NUXT_PUBLIC_TELEMETRY_INGEST_URL || "https://your-api.example.com",
      telemetryApp: process.env.NUXT_PUBLIC_TELEMETRY_APP || "my-nuxt-app",
      telemetryApiKey: process.env.NUXT_PUBLIC_TELEMETRY_API_KEY || "",
    },
  },
});
```

## Client plugin

Create `plugins/telemetry.client.ts`:

```ts
import { init } from "@telemetry-tracker/core";

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  init({
    ingestUrl: config.public.telemetryIngestUrl as string,
    app: config.public.telemetryApp as string,
    apiKey: config.public.telemetryApiKey as string,
    platform: "web",
    environment: process.dev ? "development" : "production",
  });
});
```

## Page tracking

Create `middleware/telemetry.global.ts`:

```ts
import { screen } from "@telemetry-tracker/core";

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.client) {
    screen(to.path || "/");
  }
});
```

## Custom events and identify

```ts
import { trackEvent, trackError, identify } from "@telemetry-tracker/core";

trackEvent("button_click", { id: "submit" });
trackError(new Error("Something broke"), { page: "/checkout" });
identify(user.id);
```

## Hosted cloud

Set `NUXT_PUBLIC_TELEMETRY_INGEST_URL=https://api.telemetry-tracker.com` and pass your project API key. See `/docs/hosted-cloud` on the dashboard site.
