# Deployment guide – Telemetry Tracker MVP

You have three pieces to deploy:

1. **PostgreSQL** – database (required by the API)
2. **API** (`apps/api`) – Fastify server, ingest + read endpoints (port 3001 by default)
3. **Dashboard** (`apps/dashboard`) – Next.js app (port 3000 by default)

The dashboard talks to the API via `API_URL` (server-side only; not exposed to the browser). The API talks to Postgres via `DATABASE_URL`.

**Repo layout (deployment):** `Dockerfile`, `.dockerignore`, and `docker-compose.yml` live at the **repo root**. The single Dockerfile builds the **dashboard** only (build context must be the **repo root** so `packages/`, `pnpm-workspace.yaml`, and the root `eslint.config.mjs` exist). The API has no Dockerfile (on Railway it builds with **Railpack** / default Node when Root Directory is `apps/api`). **Do not** add a repo-root `railway.toml` that sets `builder = "DOCKERFILE"` for every service—that forces the dashboard Dockerfile onto the API and fails with missing files (e.g. `eslint.config.mjs`).

---

## 1. Environment variables

### API (`apps/api`)

| Variable        | Required | Example | Description                    |
|----------------|----------|---------|--------------------------------|
| `DATABASE_URL` | Yes      | `postgresql://user:pass@host:5432/telemetry` | PostgreSQL connection string |
| `PORT`         | No       | `3001`  | Server port (default 3001)     |
| `NODE_ENV`     | No       | `production` | When `production`, CORS uses an allowlist (see below); omit or `development` for permissive local CORS. |

**Optional — production browser clients (dashboard):** When `NODE_ENV=production`, set **`CORS_ORIGINS`** (comma-separated origins, e.g. `https://app.example.com,https://www.example.com`) or a single **`DASHBOARD_ORIGIN`**. If neither is set, the API does not reflect arbitrary browser origins, so credentialed requests from a hosted dashboard will fail. Development and test keep `origin: true`.

**Optional — operations and tuning**

| Variable | Example | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Bind address (default `0.0.0.0`). |
| `SENTRY_DSN` | — | If set, uncaught handler errors are reported to Sentry (skipped when `NODE_ENV=test`). |
| `HEALTH_CHECK_DATABASE` | `true` | When `true`, `GET /health` runs a database connectivity check. |
| `RATE_LIMIT_INGEST_MAX` | `3000` | Max requests per 60s window per client on `/ingest/*` (default 3000). |
| `RATE_LIMIT_AUTH_MAX` | `30` | On `/api/auth/*` (default 30 per 60s). |
| `RATE_LIMIT_API_MAX` | `300` | On other `/api/*` routes (default 300 per 60s). |
| `RATE_LIMIT_PUBLIC_MAX` | `300` | On `GET /health` and `GET /` only (default 300 per 60s). Raise if many probes share one IP; `HEALTH_CHECK_DATABASE=true` makes `/health` heavier. |
| `TELEMETRY_ALLOW_REGISTRATION` | `true` | When `true`, `POST /api/auth/register` is allowed after at least one user row exists. The **first** user row is always allowed when the DB is empty (so you can bootstrap). Self-serve signups do **not** get an organization automatically—they create one in the dashboard (`POST /api/meta/organizations`) or join via an invite link. |
| `TELEMETRY_ORGANIZATION_ID` | UUID | **Legacy / unauthenticated dashboard reads:** default organization id used when `GET /api/meta/projects` is called **without** a session (see `project-dashboard.ts`). Seeded migrations include a matching org row. **Not** used to attach new self-serve users to an org (that path creates users with zero memberships). Built-in default UUID if unset. |
| `TELEMETRY_DASHBOARD_ORIGIN` | `https://app.example.com` | Base URL for member invite links (no trailing slash). |
| `STRIPE_SECRET_KEY` | `sk_live_…` | Required to register the Stripe webhook handler. |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Verifies `POST /webhooks/stripe` signatures. |

**Retention:** run `pnpm --filter api retention` on a schedule (e.g. nightly cron) so old telemetry rows are pruned per tier (`retentionDays` in `apps/api/src/config/plans.ts`). Requires `DATABASE_URL`.

Ingest and local dev may also use `INGEST_ALLOW_UNAUTHENTICATED` and `TELEMETRY_PROJECT_ID` (see `docs/ENTITLEMENTS.md`); never enable unauthenticated ingest in production.

**Stripe billing:** configure Checkout (or Billing Portal) in the Stripe dashboard so completed sessions include metadata `organization_id` (UUID) and `plan_tier` (`PRO` or `BUSINESS`). For plan changes that only touch the **Subscription** (not a new Checkout), set the same `plan_tier` on the **Subscription** or **Price** metadata so `customer.subscription.updated` can sync tier. Point the webhook endpoint to `https://<your-api>/webhooks/stripe` and subscribe to:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Do **not** rely on `invoice.payment_failed` to set subscription status: it can fire while the subscription is still `active` (Stripe retries). Status should come from **`customer.subscription.updated`** (and checkout retrieve when applicable).

### Dashboard (`apps/dashboard`)

| Variable    | Required | Example                      | Description                                            |
|-------------|----------|------------------------------|--------------------------------------------------------|
| `API_URL`   | No       | `https://api.yourdomain.com` | Base URL of the API (no trailing `/`). Server-only.   |
| `NEXT_PUBLIC_SITE_URL` | **Recommended** in production | `https://app.yourdomain.com` | Public origin of the dashboard (no trailing `/`). Drives `metadataBase`, canonical URLs, and Open Graph. If unset, Railway’s `RAILWAY_PUBLIC_DOMAIN` or Vercel’s `VERCEL_URL` is used when present; otherwise the build falls back to `http://localhost:3000` for metadata only—**set this for correct SEO on custom domains**. `sitemap.xml` / `robots.txt` resolve the origin at request time from the same variables. |

Default is `http://localhost:3001`. Set when the dashboard runs against a different API host.

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_TELEMETRY_PUBLIC_DASHBOARD` | If `true`, skips login middleware (local/legacy only; do not use on a public production URL). |

### PostgreSQL

If you run Postgres yourself: set `POSTGRES_PASSWORD` and `POSTGRES_DB=telemetry` (or match what you put in `DATABASE_URL`).

---

## 2. Build and run (reference)

From the repo root:

```bash
pnpm install
pnpm build
```

Then:

- **Database**: run migrations once:  
  `pnpm db:migrate` (uses `DATABASE_URL` from `apps/api/.env`).
- **API**:  
  `pnpm dev:api` or `cd apps/api && pnpm start` (after `pnpm build`).
- **Dashboard**:  
  `pnpm dev:dashboard` or `cd apps/dashboard && pnpm start` (after `pnpm build`).

For production, use `pnpm start` (or your process manager) in each app; use a real Postgres URL in `DATABASE_URL`.

---

## 3. Deployment options

### Option A: Single VPS (e.g. DigitalOcean, Hetzner, EC2)

You have one server; you run Postgres, the API, and the dashboard there.

1. **PostgreSQL**
   - Install Postgres 16 on the server, or run it in Docker:
     ```bash
     docker run -d --name telemetry-db \
       -e POSTGRES_PASSWORD=your_secure_password \
       -e POSTGRES_DB=telemetry \
       -p 5432:5432 \
       -v telemetry_pgdata:/var/lib/postgresql/data \
       postgres:16
     ```
   - Set `DATABASE_URL` to point at this instance (e.g. `postgresql://postgres:your_secure_password@localhost:5432/telemetry` if on the same host).

2. **API**
   - On the server: clone repo, `pnpm install`, `pnpm build`, set `apps/api/.env` with `DATABASE_URL` and optional `PORT`.
   - Run migrations once: `pnpm db:migrate`.
   - Run the API: `cd apps/api && pnpm start` (or use a process manager like systemd or PM2).
   - Put a reverse proxy (Nginx, Caddy) in front and expose e.g. `https://api.yourdomain.com` → `http://localhost:3001`.

3. **Dashboard**
   - On the same (or another) server: set `API_URL=https://api.yourdomain.com`, then `pnpm build` and `pnpm start` in `apps/dashboard`.
   - Serve it behind the same (or another) reverse proxy, e.g. `https://telemetry.yourdomain.com` → `http://localhost:3000`.

Use HTTPS and strong `POSTGRES_PASSWORD`; restrict Postgres port (e.g. only localhost or private network).

---

### Option B: PaaS (Railway, Render, etc.)

Use a managed PostgreSQL and deploy the API and dashboard as separate services.

#### Railway (API + DB + Dashboard)

Use these settings so **only the dashboard** uses the root Dockerfile; API and DB stay on Railpack/npm.

| Service    | Root Directory | Watch Paths (optional)     | Builder / Build |
|------------|----------------|----------------------------|------------------|
| **Database** | *(none – Postgres service)* | — | — |
| **API**      | `apps/api`     | e.g. `apps/api/**`         | **Railpack** (default) → install / `npm run build` / `npm run start` — **not** Docker |
| **Dashboard**| **empty** (repo root) | e.g. `apps/dashboard/**` | **Dockerfile** — set only on this service (see below). **Do not** use a root `railway.toml` that forces Docker globally. |

- **Database**
  - Create a PostgreSQL service. Use the URL Railway gives you (often database name `railway`). Prisma migrations will create the tables.
  - Run migrations **once** after the first API deploy: one-off `npx prisma migrate deploy` from the API service (or add it to the API start script).
- **API service** — leave as-is
  - **Root Directory**: `apps/api`.
  - **Build**: `npm install` then `npm run build`; **Start**: `npm run start` (`node dist/index.js`).
  - **Env**: `DATABASE_URL` = Railway Postgres URL (prefer **internal** when API and DB are in the same project). `PORT` is set by Railway (usually 8080).
  - **Public domain port**: When you add a domain (e.g. `telemetry-api.tacko.io`) or use the generated `*.up.railway.app` URL, set the **target port** to **8080** in the service’s **Settings → Networking** (or the domain’s port setting). If the domain points at a different port, the proxy gets “connection refused” and you see 502 even though the app is listening.
- **Dashboard service**
  - **Root Directory**: set to **empty** (clear the field so the service uses the repo root). Do **not** use `apps/dashboard` alone or Railpack/npm will fail with `Unsupported URL Type "workspace:"`.
  - **Watch Paths**: optional `apps/dashboard/**` (relative to repo root).
  - **Build** (critical): **Settings → Build** → **Builder** = **Dockerfile**, **Dockerfile path** = `Dockerfile` (repo root). There is intentionally **no** repo-root `railway.toml` that sets Docker for all services—configure Dockerfile **only on this service**. The image runs `pnpm start` in `apps/dashboard` per the Dockerfile.
  - **Env**: `API_URL` = your API’s public URL (e.g. `https://your-api.up.railway.app`).

1. **Database**
   - Create a PostgreSQL database (Railway / Render / Neon / Supabase etc.).
   - Copy the connection string → this is your `DATABASE_URL`.

2. **API**
   - New service: root or `apps/api` (depending on platform).
   - Build: `pnpm install && pnpm build` (from root, or from `apps/api` with adjusted script).
   - Start: from root `pnpm --filter api start` or from `apps/api` `node dist/index.js` (ensure Prisma is generated: `pnpm exec prisma generate`).
   - Env: `DATABASE_URL`, `PORT` (if the platform assigns a port, set it).
   - Run migrations once (CLI or one-off job): `pnpm db:migrate` (or `cd apps/api && pnpm exec prisma migrate deploy`).
   - Note the public URL of the API (e.g. `https://your-api.up.railway.app`).

3. **Dashboard**
   - New service: root or `apps/dashboard`.
   - Build: `pnpm install && pnpm build` (from root; or from `apps/dashboard` with `pnpm install && pnpm build`).
   - Env: `API_URL=https://your-api.up.railway.app` (server-side; can be set at build or runtime).
   - Start: `pnpm start` in the dashboard app (or whatever the platform uses for Next).
   - Use the URL the platform gives you for the dashboard.

If the PaaS doesn’t support pnpm monorepo builds, you can build in CI and deploy the built artifacts, or use a single-app layout (e.g. deploy only `apps/api` and `apps/dashboard` with their own `package.json` and install from root).

---

### Option C: Docker (all-in-one or per service)

You can containerize the API and the dashboard and keep Postgres in Docker too. The repo already has one **Dockerfile at repo root** (dashboard image) and **docker-compose.yml at repo root** (Postgres for local dev).

1. **Postgres**  
   Use the same `docker-compose.yml` at repo root, or run Postgres as a separate container with a volume and set `DATABASE_URL` to that container’s host (e.g. service name in compose).

2. **Dashboard** (included in repo)
   - The root **Dockerfile** builds the dashboard; build context must be repo root (for `packages/` and pnpm workspace). Run from repo root: `docker build -t dashboard .` then run the container with `API_URL` set.
   - See the root `Dockerfile` for build/start steps.

3. **API container** (not in repo; example if you want Docker for API too)
   - Build context: monorepo root (or `apps/api` with a custom Dockerfile that copies Prisma from root). Install deps, `prisma generate`, build, run `node dist/index.js`. Env: `DATABASE_URL`, `PORT`. Run migrations in an init container or entrypoint.

4. **Orchestration**
   - Use `docker-compose` with three services: `postgres`, `api`, `dashboard`, and set `DATABASE_URL` for `api` to the Postgres service name and port. Expose only the API and dashboard (and optionally put Nginx/Caddy in front for HTTPS).

---

## 4. Troubleshooting (Railway dashboard)

**Error (API service):** Docker build fails with `"/eslint.config.mjs": not found` (or similar) while copying repo-root files.

The API service is building the **dashboard Dockerfile** with a **narrow root directory** (e.g. `apps/api`). That happens when **Builder** is set to **Dockerfile** on the API service, or when a **repo-root `railway.toml`** forced `builder = "DOCKERFILE"` for every service. **Fix:** API service → **Build** → **Builder** = **Railpack** (or default), **not** Dockerfile. **Root Directory** = `apps/api`. Redeploy.

---

**Error:** `EUNSUPPORTEDPROTOCOL` / `Unsupported URL Type "workspace:"` when building the dashboard.

Railway is using **Nixpacks** (npm) instead of Docker because the dashboard service has **Root Directory** set to `apps/dashboard`. The monorepo uses **pnpm** and `workspace:*`, which npm does not support.

**Fix (dashboard service only; do not change API or Database):**

1. Open the **dashboard** service in Railway → **Settings**.
2. Set **Root Directory** to **empty** (clear the field so it uses the repo root). See the **Railway (API + DB + Dashboard)** table under Option B above.
3. **Watch Paths** can stay `apps/dashboard/**` (relative to repo root when Root Directory is empty).
4. Redeploy. In **Settings → Build**, set **Builder** to **Dockerfile** and **Dockerfile path** to `Dockerfile` so the build uses Docker + pnpm. If Railpack still runs, double-check Root Directory is empty (repo root).

**API 502 "Application failed to respond" / "connection refused" (Railway):**

The proxy cannot reach the API process. Even when deploy logs show “Listening on 0.0.0.0:8080”, 502 often means the **domain’s target port** does not match the app.

1. **Set the public port to 8080**  
   In Railway: **API service → Settings → Networking** (or **Variables** / domain settings). Find the setting for the **port** used when routing public/custom domain traffic to this service. Set it to **8080** (Railway’s default `PORT`). If it’s blank or another value (e.g. 3000), the proxy will hit the wrong port and you get “connection refused”. Save and retry (no redeploy needed).
2. **Check API runtime logs** for the API service. You should see `[api] Listening on 0.0.0.0:8080`. If you see "Startup failed" or no "Listening" line, the process is crashing (e.g. missing `DATABASE_URL`, Prisma error).
3. **Env**: Ensure `DATABASE_URL` is set. Railway sets `PORT` (usually 8080) automatically.
4. If 502 persists, set **HOST=0.0.0.0** in the API service variables and redeploy.

---

## 5. Checklist before going live

### Core

- [ ] `DATABASE_URL` uses a strong password and (if public) TLS (e.g. `?sslmode=require` for cloud Postgres).
- [ ] API and dashboard are served over HTTPS in production.
- [ ] `API_URL` points at the real API URL when running the dashboard server.
- [ ] Migrations have been run once: `pnpm db:migrate` or `prisma migrate deploy` in `apps/api`.
- [ ] **Rate limits** use separate caps for ingest, `/api/auth`, the rest of `/api`, and **`/health` + `/`** (`RATE_LIMIT_PUBLIC_MAX`; defaults per 60s window; see `RATE_LIMIT_*` above). **Request body** limit is 200 KB — acceptable for your payloads.
- [ ] **Production CORS:** `CORS_ORIGINS` or `DASHBOARD_ORIGIN` matches your deployed dashboard origin when `NODE_ENV=production`.
- [ ] The dashboard uses **email/password login**; for extra safety on a public URL, still use network controls (VPN, IP allowlist, SSO) as your threat model requires.

### Operations (self-host and production)

- [ ] **Telemetry retention:** schedule `pnpm --filter api retention` (or `tsx` equivalent) at least daily. Without it, old data is never pruned per tier (`retentionDays` in `apps/api/src/config/plans.ts`).
- [ ] **Postgres backups:** use your host’s snapshots (e.g. RDS automated backups), or a cron `pg_dump` to durable storage; verify a restore drill periodically.
- [ ] **Health checks:** set `HEALTH_CHECK_DATABASE=true` if your load balancer should fail when the DB is unreachable (`GET /health`).
- [ ] **Stripe:** webhook URL reachable and events listed in §1 (API env vars); use Stripe CLI or Dashboard “Send test webhook” after deploy.

---

## 6. Quick reference commands

| Task              | Command (from repo root)        |
|-------------------|----------------------------------|
| Install           | `pnpm install`                  |
| Build all         | `pnpm build`                    |
| Run migrations    | `pnpm db:migrate`               |
| Start API         | `pnpm dev:api` or `pnpm --filter api start` |
| Start Dashboard   | `pnpm dev:dashboard` or `pnpm --filter dashboard start` |
| Migrate (deploy)  | `pnpm --filter api exec prisma migrate deploy` |

Use `migrate deploy` (not `migrate dev`) in production so you don’t create new migration files on the server.
