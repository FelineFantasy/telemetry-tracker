# telemetry-core

Shared SDK used by all platform packages. Use it directly in any JavaScript/TypeScript app (browser, Node, React Native) when you don’t need framework-specific helpers.

## Install

In a monorepo workspace:

```bash
pnpm add telemetry-core
```

Or link via workspace: depend on `"telemetry-core": "workspace:*"` in your app’s `package.json`.

## API

### `init(config)`

Call once at app startup.

```ts
import { init } from "telemetry-core";

init({
  ingestUrl: "https://your-api.example.com",  // base URL of the ingest API (no trailing slash)
  app: "my-app",                             // app identifier
  platform: "web",                            // optional: e.g. "web", "ios", "android"
  environment: "production",                  // optional
  release: "1.2.3",                          // optional
  batchInterval: 5000,                        // optional: ms between flushes (default 5000; 0 = no batching)
  batchSize: 10,                             // optional: flush when queue reaches this size (default 10)
});
```

### `trackEvent(name, properties?)`

Send a named event with optional properties.

```ts
import { trackEvent } from "telemetry-core";

trackEvent("button_click", { button: "submit", page: "/checkout" });
```

Events are either sent immediately or queued and sent in batches (see `batchInterval` / `batchSize`).

### `trackError(error, context?)`

Send an error and optional context. The server groups errors by message + first stack line.

```ts
import { trackError } from "telemetry-core";

try {
  await doSomething();
} catch (e) {
  trackError(e instanceof Error ? e : new Error(String(e)), { action: "checkout" });
  throw e;
}
```

### `screen(name)`

Record a screen/view (sent as an event with name `$screen` and property `name`).

```ts
import { screen } from "telemetry-core";

screen("/home");
screen("Settings");
```

### `identify(userId)`

Set the current user id for subsequent events and errors.

```ts
import { identify } from "telemetry-core";

identify("user-123");
identify(null);  // clear
```

### Helpers

- **`getUserId(): string | null`** – Current user id.
- **`getConfigOrNull(): TelemetryConfig | null`** – Config if `init()` was called.

## Batching

When `batchInterval > 0` (default), `trackEvent` and `screen` are queued and sent in batches to `POST /ingest/batch`. Errors and session payloads are sent immediately. Set `batchInterval: 0` to disable batching and send every event with a single request.

## Usage without a framework package

```ts
import { init, trackEvent, trackError, screen, identify } from "telemetry-core";

init({ ingestUrl: "http://localhost:3001", app: "my-app" });

trackEvent("click", { button: "submit" });
trackError(new Error("Something broke"), { page: "/checkout" });
screen("/home");
identify("user-123");
```
