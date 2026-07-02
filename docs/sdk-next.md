# @telemetry-tracker/next

Next.js integration: provider, page tracking, and error boundary. Uses `@telemetry-tracker/core` under the hood; all events include anonymous device id and SDK version (see [telemetry-core](sdk-core.md)).

## Install

In a monorepo workspace:

```bash
pnpm add @telemetry-tracker/next
```

Peer dependencies: `next` (≥14), `react` (≥18).

## Setup

1. Wrap your app (or layout) with **`TelemetryProvider`** and pass your config.
2. Call **`useTrackPage(pathname)`** where you have access to the current pathname (e.g. in a layout or page) so route changes are sent as screen events.
3. Optionally wrap error-prone trees with **`TelemetryErrorBoundary`** so React errors are reported.

### App Router example

**`app/layout.tsx`** (or a client layout):

```tsx
"use client";

import { TelemetryProvider, useTrackPage } from "@telemetry-tracker/next";
import { usePathname } from "next/navigation";

const config = {
  ingestUrl: process.env.NEXT_PUBLIC_INGEST_URL || "http://localhost:3001",
  app: "my-next-app",
  environment: process.env.NODE_ENV,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <TelemetryProvider config={config}>
      <TrackPage />
      {children}
    </TelemetryProvider>
  );
}

function TrackPage() {
  const pathname = usePathname();
  useTrackPage(pathname ?? "/");
  return null;
}
```

### Error boundary

Wrap a section of the tree to report React errors and optionally show a fallback:

```tsx
import { TelemetryErrorBoundary } from "@telemetry-tracker/next";

<TelemetryErrorBoundary fallback={<div>Something went wrong.</div>}>
  <MyComponent />
</TelemetryErrorBoundary>
```

If you don’t pass `fallback`, the boundary renders nothing when it catches an error.

## API

| Export | Description |
|--------|-------------|
| `init(config)` | Call `@telemetry-tracker/core`’s `init` (usually done via `TelemetryProvider`). |
| `identify(userId)` | Set current user id. |
| `trackEvent(name, properties?)` | Send a named event (re-exported from core). |
| `trackError(error, context?)` | Report an error with optional context. |
| `screen(name)` | Record a screen/view (re-exported from core). |
| `TelemetryProvider({ config, children })` | Client component that calls `init(config)` on mount. |
| `useTrackPage(pathname)` | Sends `screen(pathname)` when pathname changes (client-only). |
| `TelemetryErrorBoundary` | Class component that reports errors in `componentDidCatch` and optionally renders a fallback. |

Config shape is the same as [telemetry-core](sdk-core.md#initconfig) (`TelemetryNextConfig` = `TelemetryConfig`).

## Manual init and page tracking

If you prefer not to use the provider:

```tsx
"use client";

import { init, useTrackPage } from "@telemetry-tracker/next";
import { usePathname } from "next/navigation";

init({ ingestUrl: "http://localhost:3001", app: "my-app", apiKey: process.env.NEXT_PUBLIC_TELEMETRY_API_KEY });

export function Navigation() {
  const pathname = usePathname();
  useTrackPage(pathname ?? "/");
  return <nav>...</nav>;
}
```

Ensure `init` runs only on the client (e.g. inside a `"use client"` component or `useEffect`).

## Custom events and identify

Import `trackEvent`, `screen`, and `identify` from `@telemetry-tracker/next`:

```tsx
import { trackEvent, identify } from "@telemetry-tracker/next";

trackEvent("signup_clicked", { source: "hero" });
identify(user.id);  // after login
identify(null);     // on logout
```
