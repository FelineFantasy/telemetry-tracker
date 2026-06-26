# Release and deployment process

This document describes how we cut app releases and deploy **Telemetry Tracker** (API + dashboard). SDK packages (`@tacko/telemetry-*`) use separate semver in `packages/*/package.json` and `pnpm publish:packages` — see [README](../README.md#publishing-sdk-packages-to-npm).

---

## Versioning

| Artifact | Version | Tag format |
|----------|---------|------------|
| **App** (API + dashboard) | Semver on `main` | `v1.0.0`, `v1.1.0`, … |
| **SDKs** | Per-package in `packages/*/package.json` | npm registry (optional) |

App releases are tagged on **`main`** at the commit that represents the release (usually immediately after merging the release PR or committing release notes).

---

## Release checklist (maintainers)

1. **Merge to `main`** — all changes for the release are on `main`; CI is green.
2. **Update release notes** — add a section to this file or a `CHANGELOG.md` entry (optional but recommended for v1.1+).
3. **Tag:**
   ```bash
   git checkout main && git pull origin main
   git tag -a v1.0.0 -m "Telemetry Tracker v1.0.0 — self-hosted v1"
   git push origin v1.0.0
   ```
4. **GitHub Release** — create from the tag with summary + test plan (see [gh release create](https://cli.github.com/manual/gh_release_create)).
5. **Deploy** — follow [Deploy runbook](#deploy-runbook-railway) below.
6. **Post-deploy** — run [verification](#post-deploy-verification) and [bootstrap](#bootstrap-first-production-install) if fresh install.

---

## Deploy runbook (Railway)

Production uses **three Railway services** (+ optional Cron):

| Service | Root directory | Builder |
|---------|----------------|---------|
| PostgreSQL | — | Railway Postgres |
| API | `apps/api` | Railpack (not Dockerfile) |
| Dashboard | repo root (empty) | Dockerfile |
| Retention cron (optional) | `apps/api` | Cron → `pnpm exec tsx src/jobs/run-retention.ts` |

### 1. Trigger deploy

- **Automatic:** push/merge to the branch Railway watches (usually `main`). Each service rebuilds when its watch paths change.
- **Manual:** Railway dashboard → service → **Redeploy**.

### 2. CI gate (GitHub)

On every push/PR to `main`, CI runs (`.github/workflows/ci.yml`):

- `pnpm lint`
- `prisma migrate deploy` (against CI Postgres only)
- `pnpm test` with `RUN_DB_INTEGRATION_TESTS=true`
- `pnpm build`
- telemetry-core dist drift check

**Do not tag or deploy production if CI is failing.**

### 3. Database migrations (production)

CI does **not** migrate your production database. After API deploy (or before, from your machine):

```bash
DATABASE_URL="postgresql://..." pnpm --filter api exec prisma migrate deploy
```

Use Railway Postgres **public** URL from your laptop, or a Railway one-off shell with `DATABASE_URL` set.

Alternatively, add to the API **start command** (only if you accept migrate-on-every-start):

```bash
pnpm exec prisma migrate deploy && node dist/index.js
```

Prefer one-off or deploy hook if you want explicit control.

### 4. Environment variables

Set on **each Railway service** (not only a local `.env`). Full list: [DEPLOYMENT.md](../DEPLOYMENT.md).

**API (required in production):**

- `DATABASE_URL`, `NODE_ENV=production`, `HOST=0.0.0.0`
- `HEALTH_CHECK_DATABASE=true`
- `CORS_ORIGINS` or `DASHBOARD_ORIGIN` = dashboard URL
- `TELEMETRY_DASHBOARD_ORIGIN` = dashboard URL (no trailing slash)

**API (recommended):**

- `RESEND_API_KEY`, `TELEMETRY_EMAIL_FROM` — invites and password reset
- `TELEMETRY_ALLOW_REGISTRATION=false` — after first user exists

**API (never in production):**

- `INGEST_ALLOW_UNAUTHENTICATED`
- `TELEMETRY_ALLOW_UNAUTHENTICATED_READS`

**Dashboard:**

- `API_URL` = public API URL (no trailing slash)
- `NEXT_PUBLIC_SITE_URL` = public dashboard URL

### 5. Retention cron

Schedule nightly (e.g. `0 3 * * *` UTC):

```bash
pnpm exec tsx src/jobs/run-retention.ts
```

Same `DATABASE_URL` as the API. See [DEPLOYMENT.md](../DEPLOYMENT.md).

---

## Post-deploy verification

```bash
curl -sS https://<api-host>/health
# → {"ok":true,"database":"ok"}

curl -sS -o /dev/null -w "%{http_code}" -X POST https://<api-host>/ingest/event \
  -H "Content-Type: application/json" -d '{"app":"t","name":"t"}'
# → 401

curl -sS -o /dev/null -w "%{http_code}" https://<api-host>/api/errors
# → 401
```

In the browser:

- Dashboard loads; `/dashboard` redirects to login when logged out
- Register (if allowed) → org → project → API key → ingest → Overview shows data

See also [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md).

---

## Bootstrap (first production install)

1. Deploy Postgres, API, dashboard; run migrations.
2. Open dashboard → **Register** (allowed when no users exist).
3. Create organization, project, API key.
4. Set `TELEMETRY_ALLOW_REGISTRATION=false` on API.
5. Schedule retention cron.

---

## v1.0.0 (2026-06-26)

First production-ready self-hosted release.

**Includes:**

- Multi-tenant ingest (events, errors, sessions, batch) with API keys and plan limits
- Next.js dashboard (overview, errors, events, sessions, org/team/keys settings)
- Email/password auth, org invites, password reset (Resend)
- RBAC (OWNER / EDITOR / VIEWER)
- Optional Stripe billing (checkout, portal, webhooks)
- SDKs `@tacko/telemetry-*` v1.2.0 in-repo
- Retention job, deployment docs, CI with DB integration tests

**Known limitations:**

- Per-project ingest RPS is in-memory (single API process)
- No built-in error spike alerts
- Open sessions without `ended_at` are not pruned by retention until closed

**Live reference deployment:** `telemetry-tracker.tacko.io` / `telemetry-api.tacko.io`
