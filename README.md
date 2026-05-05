# Telemetry Tracker MVP

Lightweight internal telemetry: errors, events, sessions, and a simple dashboard.

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **PostgreSQL**

   Start Postgres (e.g. with Docker):

   ```bash
   docker compose up -d
   ```

   Copy env for the API and dashboard (optional):

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/dashboard/.env.example apps/dashboard/.env
   ```

   Run migrations:

   ```bash
   pnpm db:migrate
   ```

3. **Build**

   ```bash
   pnpm build
   ```

4. **Tests** (optional)

   ```bash
   pnpm test
   ```

   Runs Vitest for the API and dashboard. Database-backed integration tests in `apps/api` need Postgres and `RUN_DB_INTEGRATION_TESTS=true`.

## Run

- **API** (ingest + read): `pnpm dev:api` (default port 3001)
- **Dashboard**: `pnpm dev:dashboard` (default port 3000)

Override `API_URL` in `apps/dashboard/.env` if the dashboard runs against a different API host (server-side only; not exposed to the browser).

## Deployment (Railway)

The repo is set up for **Railway**: Postgres + API (root `apps/api`) + Dashboard (root Dockerfile at repo root). All deployment-related files (`Dockerfile`, `railway.toml`, `.dockerignore`, `docker-compose.yml`) are at repo root. See [DEPLOYMENT.md](DEPLOYMENT.md) for env vars (including production **CORS** and **rate limits**), Root Directory settings, and migrations.

## Project layout

- `apps/api` – Fastify ingest API: `POST /ingest/event`, `POST /ingest/error`, `POST /ingest/session`, `POST /ingest/batch`; read API: `GET /api/overview`, `GET /api/errors`, `GET /api/errors/:id`, `GET /api/events`, `GET /api/sessions`, …; session auth under `/api/auth/*`; org/project/API keys under `/api/meta/*` and `/api/project/*`
- `apps/dashboard` – Next.js app: Overview, Errors list/detail, Events list
- `packages/telemetry-core` – Shared SDK: `init()`, `trackEvent()`, `trackError()`, `screen()`, `identify()`; optional batching; anonymous device id and SDK version on every payload; in the browser, global `window.onerror` and `unhandledrejection` after `init()`
- `packages/telemetry-next` – Next.js: provider, error boundary, `useTrackPage()`
- `packages/telemetry-react-native` – React Native: global error handler, session, `trackScreen()`
- `packages/telemetry-node` – Node: `uncaughtException` / `unhandledRejection`, optional middleware

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for prerequisites, local setup, and what CI runs. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md). **Security:** report vulnerabilities privately per [SECURITY.md](SECURITY.md)—do not use public issues for undisclosed security bugs.

## SDK usage

**Core (any app):**

```ts
import { init, trackEvent, trackError, screen, identify } from "@tacko/telemetry-core";

init({ ingestUrl: "http://localhost:3001", app: "my-app" });
trackEvent("click", { button: "submit" });
trackError(new Error("Something broke"), { page: "/checkout" });
screen("/home");
identify("user-123");
```

**Next.js:** Use `TelemetryProvider` with config and `useTrackPage(pathname)` in a layout or page; import `trackEvent`, `screen`, and `identify` from `@tacko/telemetry-next` when needed.

**Node:** `init(config)` then use `trackEvent` / `trackError`; optional `middleware()` for request tracking.

## Publishing SDK packages to npm

The SDK packages are published under the `@tacko` scope (`@tacko/telemetry-core`, `@tacko/telemetry-next`, `@tacko/telemetry-node`, `@tacko/telemetry-react-native`) so others can install them from the public npm registry.

1. **Log in to npm** (one-time): `npm login`
2. **Update repository URLs** in each `packages/*/package.json` if your GitHub org/username is not `unjica`.
3. **Dry run** (no publish): `pnpm publish:dry`
4. **Publish**: `pnpm publish:packages` (if your npm account uses 2FA, append your one-time password: `pnpm publish:packages -- --otp=123456`)

**Versioning:** Each new publish must use a version greater than what’s already on npm for that package (e.g. bump `version` in `packages/telemetry-core/package.json` and the other three before running `publish:packages`). Dry-run may fail if you’re not logged in or if the local version is lower than the published one.

Publishing order is automatic: `@tacko/telemetry-core` first, then the others. The script temporarily sets each dependent’s core dependency to `^<coreVersion>` for the published tarball, then restores.
