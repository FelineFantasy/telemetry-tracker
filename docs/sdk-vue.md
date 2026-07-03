# Vue 3

Browser integration for Vue 3 SPAs with **vue-router**. Uses `@telemetry-tracker/core` directly (no separate npm package). For Nuxt, see [sdk-nuxt.md](sdk-nuxt.md).

## Install

```bash
pnpm add @telemetry-tracker/core
```

## Vite environment

```env
VITE_TELEMETRY_INGEST_URL=https://your-api.example.com
VITE_TELEMETRY_APP=my-vue-app
VITE_TELEMETRY_API_KEY=tt_live_<publicId>_<secret>
```

## Setup

Initialize in `main.ts` before mounting, then track route changes:

```ts
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { init, screen } from "@telemetry-tracker/core";

init({
  ingestUrl: import.meta.env.VITE_TELEMETRY_INGEST_URL,
  app: import.meta.env.VITE_TELEMETRY_APP ?? "my-vue-app",
  apiKey: import.meta.env.VITE_TELEMETRY_API_KEY,
  platform: "web",
  environment: import.meta.env.MODE,
});

router.afterEach((to) => {
  screen(to.fullPath || "/");
});

createApp(App).use(router).mount("#app");
```

## API

Same as [telemetry-core](sdk-core.md): `init`, `trackEvent`, `trackError`, `screen`, `identify`, `getSessionId`, `endSession`.

After `init()`, the core SDK registers `window.onerror` and `unhandledrejection` in the browser.

## Hosted cloud

Point `ingestUrl` at `https://api.telemetry-tracker.com` and use an API key from [telemetry-tracker.com](https://telemetry-tracker.com). See the dashboard guide at `/docs/hosted-cloud`.
