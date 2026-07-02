# @telemetry-tracker/node

Node.js integration: automatic reporting of `uncaughtException` and `unhandledRejection`, plus optional request middleware. Uses `@telemetry-tracker/core` under the hood; all payloads include anonymous id and SDK version (see [telemetry-core](sdk-core.md)).

## Install

In a monorepo workspace:

```bash
pnpm add @telemetry-tracker/node
```

## Setup

Call **`init(config)`** once at process startup (e.g. before starting your HTTP server). This will:

- Initialize the core SDK.
- Register `process.on("uncaughtException")` and `process.on("unhandledRejection")` to report those errors before rethrowing (or exiting).

```ts
import { init, trackEvent, trackError } from "@telemetry-tracker/node";

init({
  ingestUrl: "https://your-api.example.com",
  app: "my-backend",
  apiKey: process.env.TELEMETRY_API_KEY,
  platform: "node",  // default
});
```

## API

| Export | Description |
|--------|-------------|
| `init(config)` | Initialize SDK and install global error handlers. |
| `identify(userId)` | Set current user id (e.g. from request context). |
| `trackEvent(name, properties?)` | Send a named event. |
| `trackError(error, context?)` | Report an error. |
| `getConfig()` | Current config or null. |
| `middleware(opts?)` | Optional generic middleware that tracks `$request` events (method, url, duration). |

Config extends [telemetry-core](sdk-core.md#initconfig) and requires `app`; `platform` defaults to `"node"`.

## Global error handlers

After `init()`:

- **uncaughtException**: Error is reported with `{ source: "uncaughtException" }`, then rethrown (process typically exits).
- **unhandledRejection**: Reason is reported as an error with `{ source: "unhandledRejection" }`.

You can still use `trackError` in try/catch or domain handlers for extra context.

## Request middleware

`middleware(opts?)` returns a generic middleware function with signature:

```ts
(req, res, next) => void
```

It records a `$request` event with:

- `method`, `url`, `duration_ms`
- Optionally `body` when `opts.trackRequestBody === true`

The implementation assumes a minimal `req`: `method`, `url`, and optionally `body` and `on(event, listener)`. It is not tied to Express or Fastify; you can adapt it or use it in a custom stack. Example (conceptual):

```ts
import { init, middleware } from "@telemetry-tracker/node";

init({ ingestUrl: "http://localhost:3001", app: "api", apiKey: process.env.TELEMETRY_API_KEY, environment: "development" });

const telemetryMiddleware = middleware({ trackRequestBody: false });

// Use in your stack; call next() so the request continues.
function handleRequest(req, res) {
  telemetryMiddleware(req, res, () => {
    // your handler
  });
}
```

For Express you’d typically do `app.use(telemetryMiddleware)` if the middleware calls `next()` and matches Express’ (req, res, next) shape. Our middleware is generic and may need a thin wrapper to match your framework’s expectations.
