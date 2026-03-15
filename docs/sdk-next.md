# telemetry-next

Next.js integration: provider, page tracking, and error boundary. Uses `telemetry-core` under the hood.

## Install

In a monorepo workspace:

```bash
pnpm add telemetry-next
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

import { TelemetryProvider, useTrackPage } from "telemetry-next";
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
import { TelemetryErrorBoundary } from "telemetry-next";

<TelemetryErrorBoundary fallback={<div>Something went wrong.</div>}>
  <MyComponent />
</TelemetryErrorBoundary>
```

If you don’t pass `fallback`, the boundary renders nothing when it catches an error.

## API

| Export | Description |
|--------|-------------|
| `init(config)` | Call `telemetry-core`’s `init` (usually done via `TelemetryProvider`). |
| `identify(userId)` | Set current user id. |
| `trackError(error, context?)` | Report an error with optional context. |
| `TelemetryProvider({ config, children })` | Client component that calls `init(config)` on mount. |
| `useTrackPage(pathname)` | Sends `screen(pathname)` when pathname changes (client-only). |
| `TelemetryErrorBoundary` | Class component that reports errors in `componentDidCatch` and optionally renders a fallback. |

Config shape is the same as [telemetry-core](sdk-core.md#initconfig) (`TelemetryNextConfig` = `TelemetryConfig`).

## Manual init and page tracking

If you prefer not to use the provider:

```tsx
"use client";

import { init, useTrackPage } from "telemetry-next";
import { usePathname } from "next/navigation";

init({ ingestUrl: "http://localhost:3001", app: "my-app" });

export function Navigation() {
  const pathname = usePathname();
  useTrackPage(pathname ?? "/");
  return <nav>...</nav>;
}
```

Ensure `init` runs only on the client (e.g. inside a `"use client"` component or `useEffect`).
