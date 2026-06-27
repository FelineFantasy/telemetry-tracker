# Railway deployment

Deploy **Postgres + API + dashboard** as separate Railway services. Core env vars: [DEPLOYMENT.md](../DEPLOYMENT.md).

**Do not** add a repo-root `railway.toml` that sets `builder = "DOCKERFILE"` for every service — that forces the dashboard Dockerfile onto the API and breaks the build.

---

## Services

| Service | Root directory | Builder |
|---------|----------------|---------|
| **PostgreSQL** | — | Railway Postgres |
| **API** | `apps/api` | **Railpack** (default Node) — **not** Dockerfile |
| **Dashboard** | **empty** (repo root) | **Dockerfile** (repo root) — **only on this service** |
| **Retention cron** (optional) | `apps/api` | Cron job |

---

## PostgreSQL

1. Create a PostgreSQL service in your Railway project.
2. Copy **`DATABASE_URL`** to the API (and cron) service — prefer the **internal** URL when services are in the same project.

---

## API service

| Setting | Value |
|---------|--------|
| Root Directory | `apps/api` |
| Build | `npm install` → `npm run build` |
| Start | `npm run start` (`node dist/index.js`) |
| Watch Paths (optional) | `apps/api/**` |

**Env (minimum):** `DATABASE_URL`, `NODE_ENV=production`, `HOST=0.0.0.0`, `HEALTH_CHECK_DATABASE=true`, `CORS_ORIGINS` or `DASHBOARD_ORIGIN`, `TELEMETRY_DASHBOARD_ORIGIN`.

Railway sets **`PORT`** (usually **8080**). When adding a custom domain, set the **public target port to 8080** in **Settings → Networking**.

**Migrations** (once after first deploy, from your machine or a one-off shell):

```bash
DATABASE_URL="postgresql://..." pnpm --filter api exec prisma migrate deploy
```

Optional: Resend, Stripe, registration flags — [BILLING.md](./BILLING.md) and [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md).

---

## Dashboard service

| Setting | Value |
|---------|--------|
| Root Directory | **empty** (repo root — not `apps/dashboard`) |
| Builder | **Dockerfile**, path `Dockerfile` |
| Watch Paths (optional) | `apps/dashboard/**` |

**Env:** `API_URL` = public API URL; `NEXT_PUBLIC_SITE_URL` = public dashboard URL (recommended).

If the build fails with `Unsupported URL Type "workspace:"`, Railway is using npm/Nixpacks instead of Docker — clear Root Directory to repo root and set Builder to Dockerfile on **this service only**.

---

## Retention cron

Add a **Cron** service (or scheduled job):

| Setting | Value |
|---------|--------|
| Root Directory | `apps/api` |
| Start command | `node dist/jobs/run-retention.js` |
| Cron schedule | `0 3 * * *` (03:00 UTC daily) |
| `DATABASE_URL` | Same as API |

The job must **exit when finished** (disconnects Prisma). If a run stays active, Railway skips the next schedule.

Logs should show JSON like: `{"ok":true,"projectsProcessed":…}`.

---

## Troubleshooting

### API: Docker build fails — `eslint.config.mjs` not found

The API service is using the **dashboard Dockerfile** or a repo-root Docker setting.

**Fix:** API → **Build** → **Builder** = **Railpack** (not Dockerfile). **Root Directory** = `apps/api`. Redeploy.

### Dashboard: `EUNSUPPORTEDPROTOCOL` / `workspace:`

Root Directory is `apps/dashboard` and npm cannot resolve pnpm workspaces.

**Fix:** Dashboard → **Root Directory** = **empty** (repo root) → **Builder** = **Dockerfile** → redeploy.

### API: 502 / connection refused

Deploy logs show `Listening on 0.0.0.0:8080` but the domain still 502s.

1. **Networking / domain port** → set target port **8080** (matches Railway `PORT`).
2. Check runtime logs for startup crashes (`DATABASE_URL`, Prisma errors).
3. Set **`HOST=0.0.0.0`** if needed and redeploy.

---

## Other PaaS (Render, Fly, etc.)

Same three pieces: managed Postgres, API from `apps/api`, dashboard from repo root Dockerfile or a monorepo-aware build. Set the same env vars as above. If the platform cannot build pnpm workspaces, build in CI and deploy artifacts.

See also [RELEASE.md](./RELEASE.md) for the maintainer deploy runbook and post-deploy verification.
