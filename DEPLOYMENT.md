# Deployment guide – Telemetry Tracker MVP

You have three pieces to deploy:

1. **PostgreSQL** – database (required by the API)
2. **API** (`apps/api`) – Fastify server, ingest + read endpoints (port 3001 by default)
3. **Dashboard** (`apps/dashboard`) – Next.js app (port 3000 by default)

The dashboard talks to the API via `API_URL` (server-side only; not exposed to the browser). The API talks to Postgres via `DATABASE_URL`.

**Repo layout (deployment):** `Dockerfile`, `railway.toml`, `.dockerignore`, and `docker-compose.yml` live at the **repo root**. The single Dockerfile builds the dashboard (context = repo root, for workspace deps). The API has no Dockerfile in the repo (Railway uses Nixpacks for it).

---

## 1. Environment variables

### API (`apps/api`)

| Variable        | Required | Example | Description                    |
|----------------|----------|---------|--------------------------------|
| `DATABASE_URL` | Yes      | `postgresql://user:pass@host:5432/telemetry` | PostgreSQL connection string |
| `PORT`         | No       | `3001`  | Server port (default 3001)     |

### Dashboard (`apps/dashboard`)

| Variable    | Required | Example                      | Description                                            |
|-------------|----------|------------------------------|--------------------------------------------------------|
| `API_URL`   | No       | `https://api.yourdomain.com` | Base URL of the API (no trailing `/`). Server-only.   |

Default is `http://localhost:3001`. Set when the dashboard runs against a different API host.

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

Use these settings so only the dashboard uses the root Dockerfile; API and DB are unchanged.

| Service    | Root Directory | Watch Paths (optional)     | Builder / Build |
|------------|----------------|----------------------------|------------------|
| **Database** | *(none – Postgres service)* | — | — |
| **API**      | `apps/api`     | e.g. `apps/api/**`         | Nixpacks → `npm install` / `npm run build` / `npm run start` |
| **Dashboard**| **empty** (repo root) | e.g. `apps/dashboard/**` | Docker (root `Dockerfile` + `railway.toml`) |

- **Database**
  - Create a PostgreSQL service. Use the URL Railway gives you (often database name `railway`). Prisma migrations will create the tables.
  - Run migrations **once** after the first API deploy: one-off `npx prisma migrate deploy` from the API service (or add it to the API start script).
- **API service** — leave as-is
  - **Root Directory**: `apps/api`.
  - **Build**: `npm install` then `npm run build`; **Start**: `npm run start` (`node dist/index.js`).
  - **Env**: `DATABASE_URL` = Railway Postgres URL (prefer **internal** when API and DB are in the same project). `PORT` is set by Railway.
- **Dashboard service** — fix only this one
  - **Root Directory**: set to **empty** (clear the field so the service uses the repo root). Do **not** use `apps/dashboard` or Railway will use Nixpacks/npm and fail with `Unsupported URL Type "workspace:"`.
  - **Watch Paths**: you can keep `apps/dashboard/**` so only dashboard changes trigger redeploys (path is relative to repo root when Root Directory is empty).
  - **Build**: With root as Root Directory, the root `railway.toml` forces Docker; the root `Dockerfile` builds the dashboard with pnpm. **Start**: handled by the Dockerfile (`pnpm start` in `apps/dashboard`).
  - **Env**: `API_URL` = your API’s public URL (e.g. `https://your-api.up.railway.app`). Add a custom domain in the dashboard service if you want (e.g. `telemetry.yourdomain.com`).

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
   - See the Dockerfile and `railway.toml` at root for the exact build/start steps.

3. **API container** (not in repo; example if you want Docker for API too)
   - Build context: monorepo root (or `apps/api` with a custom Dockerfile that copies Prisma from root). Install deps, `prisma generate`, build, run `node dist/index.js`. Env: `DATABASE_URL`, `PORT`. Run migrations in an init container or entrypoint.

4. **Orchestration**
   - Use `docker-compose` with three services: `postgres`, `api`, `dashboard`, and set `DATABASE_URL` for `api` to the Postgres service name and port. Expose only the API and dashboard (and optionally put Nginx/Caddy in front for HTTPS).

---

## 4. Troubleshooting (Railway dashboard)

**Error:** `EUNSUPPORTEDPROTOCOL` / `Unsupported URL Type "workspace:"` when building the dashboard.

Railway is using **Nixpacks** (npm) instead of Docker because the dashboard service has **Root Directory** set to `apps/dashboard`. The monorepo uses **pnpm** and `workspace:*`, which npm does not support.

**Fix (dashboard service only; do not change API or Database):**

1. Open the **dashboard** service in Railway → **Settings**.
2. Set **Root Directory** to **empty** (clear the field so it uses the repo root). See the [Railway table](#railway-api--db--dashboard) above.
3. **Watch Paths** can stay `apps/dashboard/**` (relative to repo root when Root Directory is empty).
4. Redeploy. The root `railway.toml` and `Dockerfile` will be used; build will use Docker + pnpm. If Nixpacks still runs, in **Settings → Build** choose Dockerfile as the builder if available.

---

## 5. Checklist before going live

- [ ] `DATABASE_URL` uses a strong password and (if public) TLS (e.g. `?sslmode=require` for cloud Postgres).
- [ ] API and dashboard are served over HTTPS in production.
- [ ] `API_URL` points at the real API URL when running the dashboard server.
- [ ] Migrations have been run once: `pnpm db:migrate` or `prisma migrate deploy` in `apps/api`.
- [ ] Rate limit (300/min) and body limit (200 KB) are acceptable for your usage (they are set in the API code).
- [ ] Dashboard has no auth in this MVP; if the URL is public, restrict access (e.g. VPN, IP allowlist, or add a simple auth layer later).

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
