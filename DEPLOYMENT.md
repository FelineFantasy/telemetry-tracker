# Deployment guide – Telemetry Tracker MVP

You have three pieces to deploy:

1. **PostgreSQL** – database (required by the API)
2. **API** (`apps/api`) – Fastify server, ingest + read endpoints (port 3001 by default)
3. **Dashboard** (`apps/dashboard`) – Next.js app (port 3000 by default)

The dashboard talks to the API via `API_URL` (server-side only; not exposed to the browser). The API talks to Postgres via `DATABASE_URL`.

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

- **Database**
  - Create a PostgreSQL service. Use the URL Railway gives you (often database name `railway`). Prisma migrations will create the tables.
  - Run migrations **once** after the first API deploy: one-off `npx prisma migrate deploy` from the API service (or add it to the API start script).
- **API service**
  - **Root Directory**: `apps/api`.
  - **Build**: `npm install` then `npm run build` (Railway uses the API’s `package.json`; `build` runs `prisma generate && tsc`).
  - **Start**: `npm run start` (`node dist/index.js`).
  - **Env**: `DATABASE_URL` = Railway Postgres URL; use the **internal** URL when API and DB are in the same project. `PORT` is set by Railway.
- **Dashboard service**
  - **Root Directory**: leave **empty** (repo root) so the build context includes `packages/` and `apps/`.
  - **Build**: Use **Docker** (not Nixpacks). Railway will use the repo’s root `Dockerfile`, which builds the dashboard and its workspace deps. No custom build command needed.
  - **Start**: handled by the Dockerfile (`pnpm start` in `apps/dashboard`).
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

You can containerize the API and the dashboard and keep Postgres in Docker too.

1. **Postgres**  
   Use the same `docker-compose.yml` you have, or run Postgres as a separate container with a volume and set `DATABASE_URL` to that container’s host (e.g. service name in compose).

2. **API Dockerfile** (example, from repo root)
   - Build context: monorepo root so `packages/telemetry-*` and Prisma are available.
   - Install deps, generate Prisma client, build API, run `node apps/api/dist/index.js` (or run from `apps/api` with correct paths).
   - Env: `DATABASE_URL`, `PORT`.
   - Run migrations in an init container or entrypoint before starting the server.

3. **Dashboard Dockerfile** (example)
   - Build: set `API_URL` if needed, then `pnpm build` for the dashboard.
   - Run: `pnpm start` in the dashboard app (or `next start`).
   - Env at runtime: only if you use server-side env; for this MVP the API URL is baked in at build time.

4. **Orchestration**
   - Use `docker-compose` with three services: `postgres`, `api`, `dashboard`, and set `DATABASE_URL` for `api` to the Postgres service name and port. Expose only the API and dashboard (and optionally put Nginx/Caddy in front for HTTPS).

---

## 4. Checklist before going live

- [ ] `DATABASE_URL` uses a strong password and (if public) TLS (e.g. `?sslmode=require` for cloud Postgres).
- [ ] API and dashboard are served over HTTPS in production.
- [ ] `API_URL` points at the real API URL when running the dashboard server.
- [ ] Migrations have been run once: `pnpm db:migrate` or `prisma migrate deploy` in `apps/api`.
- [ ] Rate limit (300/min) and body limit (200 KB) are acceptable for your usage (they are set in the API code).
- [ ] Dashboard has no auth in this MVP; if the URL is public, restrict access (e.g. VPN, IP allowlist, or add a simple auth layer later).

---

## 5. Quick reference commands

| Task              | Command (from repo root)        |
|-------------------|----------------------------------|
| Install           | `pnpm install`                  |
| Build all         | `pnpm build`                    |
| Run migrations    | `pnpm db:migrate`               |
| Start API         | `pnpm dev:api` or `pnpm --filter api start` |
| Start Dashboard   | `pnpm dev:dashboard` or `pnpm --filter dashboard start` |
| Migrate (deploy)  | `pnpm --filter api exec prisma migrate deploy` |

Use `migrate deploy` (not `migrate dev`) in production so you don’t create new migration files on the server.
