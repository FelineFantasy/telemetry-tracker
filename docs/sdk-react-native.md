# @tacko/telemetry-react-native

React Native integration: global error handler, session tracking, and screen helpers. Uses `@tacko/telemetry-core` under the hood; sessions and events include anonymous id and SDK version (see [telemetry-core](sdk-core.md)).

## Install

In a monorepo workspace:

```bash
pnpm add @tacko/telemetry-react-native
```

Peer dependency: `react-native`.

## Setup

Call **`init(config)`** once at app startup (e.g. in your root component or entry file). This will:

- Initialize the core SDK.
- Start a session and send it to `POST /ingest/session`.
- Register a global error handler via `ErrorUtils.setGlobalHandler` (when available) so unhandled errors are reported.

```tsx
import { init } from "@tacko/telemetry-react-native";

init({
  ingestUrl: "https://your-api.example.com",
  app: "my-mobile-app",
  platform: "react-native",  // or "ios" / "android"
});
```

## API

| Export | Description |
|--------|-------------|
| `init(config)` | Initialize SDK, start session, register global error handler. |
| `identify(userId)` | Set current user id. |
| `trackEvent(name, properties?)` | Send a named event. |
| `trackError(error, context?)` | Report an error. |
| `screen(name)` | Record a screen (alias for core `screen`). |
| `trackScreen(name)` | Same as `screen(name)`. |
| `getSessionId()` | Current session id (or null). |
| `endSession()` | End the current session (sends session with `ended_at`) and clear session id. |

Config extends [telemetry-core](sdk-core.md#initconfig) and requires `app`; `platform` defaults to `"react-native"`.

## Screen tracking with React Navigation

When using React Navigation, call `screen` or `trackScreen` when the screen changes. Example with `@react-navigation/native`:

```tsx
import { useNavigationContainerRef } from "@react-navigation/native";
import { trackScreen } from "@tacko/telemetry-react-native";
import { useEffect } from "react";

export function useTelemetryScreenTracking() {
  const ref = useNavigationContainerRef();

  useEffect(() => {
    if (!ref?.getCurrentRoute) return;
    const name = ref.getCurrentRoute()?.name ?? "Unknown";
    trackScreen(name);
    const unsubscribe = ref.addListener("state", () => {
      const route = ref.getCurrentRoute();
      if (route?.name) trackScreen(route.name);
    });
    return unsubscribe;
  }, [ref]);
}
```

Call `useTelemetryScreenTracking()` inside a component that’s mounted when the navigator is ready.

## Sessions

- A session is started automatically when you call `init()`.
- The session id is generated and sent to the ingest API as `POST /ingest/session` with `started_at`.
- Call **`endSession()`** when the user backgrounds the app or logs out to send an update with `ended_at`; the next user action can call `init()` again to start a new session.

## Global errors

If React Native’s `ErrorUtils.setGlobalHandler` is available, `init()` replaces it with a handler that:

1. Reports the error via `trackError(error, { source: "globalHandler" })`.
2. Does not re-invoke the previous handler (to avoid duplicate reports from this SDK).

Use `trackError` in your own try/catch or error boundaries for additional context.
