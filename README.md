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

## Run

- **API** (ingest + read): `pnpm dev:api` (default port 3001)
- **Dashboard**: `pnpm dev:dashboard` (default port 3000)

Override `API_URL` in `apps/dashboard/.env` if the dashboard runs against a different API host (server-side only; not exposed to the browser).

## Deployment (Railway)

The repo is set up for **Railway**: Postgres + API (root `apps/api`) + Dashboard (root Dockerfile at repo root). See [DEPLOYMENT.md](DEPLOYMENT.md) for env vars, Root Directory settings, and migrations.

## Project layout

- `apps/api` – Fastify ingest API: `POST /ingest/event`, `POST /ingest/error`, `POST /ingest/session`, `POST /ingest/batch`; read API: `GET /api/overview`, `GET /api/errors`, `GET /api/errors/:id`, `GET /api/events`
- `apps/dashboard` – Next.js app: Overview, Errors list/detail, Events list
- `packages/telemetry-core` – Shared SDK: `init()`, `trackEvent()`, `trackError()`, `screen()`, `identify()`; optional batching
- `packages/telemetry-next` – Next.js: provider, error boundary, `useTrackPage()`
- `packages/telemetry-react-native` – React Native: global error handler, session, `trackScreen()`
- `packages/telemetry-node` – Node: `uncaughtException` / `unhandledRejection`, optional middleware

## SDK usage

**Core (any app):**

```ts
import { init, trackEvent, trackError, screen, identify } from "telemetry-core";

init({ ingestUrl: "http://localhost:3001", app: "my-app" });
trackEvent("click", { button: "submit" });
trackError(new Error("Something broke"), { page: "/checkout" });
screen("/home");
identify("user-123");
```

**Next.js:** Use `TelemetryProvider` with config and `useTrackPage(pathname)` in a layout or page.

**Node:** `init(config)` then use `trackEvent` / `trackError`; optional `middleware()` for request tracking.
