# Contributing to Telemetry Tracker

Thanks for helping improve this project. This document matches the monorepo layout and what CI runs on pull requests.

## Prerequisites

- **Node.js** 18 or newer (CI uses Node 20).
- **pnpm** 9 (see `package.json` / CI).
- **PostgreSQL** 16 for local development and for API integration tests.

## Quick start

```bash
pnpm install
docker compose up -d
cp apps/api/.env.example apps/api/.env   # if present; set DATABASE_URL
pnpm db:migrate
pnpm build
pnpm lint
pnpm test
```

Default tests run Vitest smoke/unit suites. To run **database-backed API integration tests** locally (same as CI):

```bash
export RUN_DB_INTEGRATION_TESTS=true
# DATABASE_URL must point at a reachable Postgres with migrations applied
pnpm --filter api test
```

## Before you open a PR

1. **Lint:** `pnpm lint`
2. **Tests:** `pnpm test` (with Postgres + `RUN_DB_INTEGRATION_TESTS=true` if you changed API behavior covered by integration tests)
3. **Build:** `pnpm build`

CI on `main` runs lint, `prisma migrate deploy`, tests with `RUN_DB_INTEGRATION_TESTS=true`, and a full workspace build (see [.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Project layout

- `apps/api` — Fastify API, Prisma schema and migrations under `apps/api/prisma/`
- `apps/dashboard` — Next.js dashboard
- `packages/*` — SDKs (`@tacko/telemetry-*`)

Design and entitlement rules are summarized in [docs/ENTITLEMENTS.md](docs/ENTITLEMENTS.md); deployment in [DEPLOYMENT.md](DEPLOYMENT.md); RBAC in [docs/RBAC.md](docs/RBAC.md).

## Database migrations

Create migrations from `apps/api` context after schema changes:

```bash
pnpm db:migrate
```

Use descriptive migration names. For production, only `prisma migrate deploy` is used (see DEPLOYMENT.md).

## Pull requests

- Prefer **focused** changes: one concern per PR when possible.
- Describe **what** changed and **why** in the PR body (reproduce steps for bugs).
- If you are unsure about product or security behavior (auth, ingest, billing), open an issue first.

## Good first issues

New contributors: look for issues labeled [**good first issue**](https://github.com/Telemetry-Tracker/telemetry-tracker/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22). Suggested starting points:

- Documentation and tests (low risk, helps you learn the repo layout)
- Retention and ingest edge cases called out in [PRODUCTION-READINESS.md](docs/PRODUCTION-READINESS.md) known limitations
- Dashboard polish and accessibility

Comment on an issue before opening a PR if you want to confirm scope.

## Code of conduct

Participation is governed by the [Contributor Covenant](CODE_OF_CONDUCT.md). Please read it before contributing.

## Security

Do **not** open public issues for undisclosed vulnerabilities. See [SECURITY.md](SECURITY.md).
