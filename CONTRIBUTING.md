# Contributing to Telemetry Tracker

Thanks for taking the time to contribute! Every contribution—whether it's code, documentation, bug reports, or feedback—is appreciated.

This document matches the monorepo layout and what CI runs on pull requests.

## How can I contribute?

### Ways to contribute

Every contribution, no matter how small, helps improve the project.

Some great first contributions include:

- Fixing bugs
- Improving documentation
- Writing tests
- Improving accessibility
- Improving developer experience
- Reviewing documentation

Browse [**good first issues**](https://github.com/Telemetry-Tracker/telemetry-tracker/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) and [help wanted](https://github.com/Telemetry-Tracker/telemetry-tracker/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) on GitHub. Retention and ingest edge cases in [PRODUCTION-READINESS.md](docs/PRODUCTION-READINESS.md) are also good entry points.

Comment on an issue before opening a PR if you want to confirm scope.

## Prerequisites

- **Node.js** 18+ supported; 20+ recommended.
- **pnpm** 9 (see `package.json` / CI).
- **PostgreSQL** 16 for local development and for API integration tests.

## Quick start

Install → run API & dashboard → verify → build → lint → tests

### 1. Install

```bash
pnpm install
docker compose up -d
cp apps/api/.env.example apps/api/.env
cp apps/dashboard/.env.example apps/dashboard/.env
pnpm db:migrate
```

### 2. Run API & dashboard

In **two terminals**:

```bash
pnpm dev:api        # http://localhost:3001
pnpm dev:dashboard  # http://localhost:3000
```

### 3. Verify

Open **http://localhost:3000** and confirm the dashboard loads (register or sign in if you want to click through the full flow).

### 4. Build, lint & tests

Before opening a PR, run:

```bash
pnpm build
pnpm lint
pnpm test
```

Default tests run Vitest smoke/unit suites. For **database-backed API integration tests** (same as CI):

```bash
export RUN_DB_INTEGRATION_TESTS=true
pnpm --filter api test
```

## Project layout

```
apps/
  api/          # Fastify API, Prisma schema and migrations
  dashboard/    # Next.js dashboard

packages/
  telemetry-core/
  telemetry-next/
  telemetry-node/
  telemetry-react-native/
```

SDKs are published as `@tacko/telemetry-*` on npm.

Design and entitlement rules are summarized in [docs/ENTITLEMENTS.md](docs/ENTITLEMENTS.md); architecture in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); deployment in [DEPLOYMENT.md](DEPLOYMENT.md) and [docs/RAILWAY.md](docs/RAILWAY.md); RBAC in [docs/RBAC.md](docs/RBAC.md).

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

### Branch naming

Use one branch per pull request.

Use lowercase kebab-case with a type prefix:

```
feature/add-slack-webhook
fix/session-memory-leak
docs/readme-improvements
```

Common prefixes: `feature/`, `fix/`, `docs/`, `test/`, `chore/`. Keep names short and descriptive.

### Commit messages

Use the imperative mood.

Good examples:

```
Fix session filtering
Improve SDK docs
Add webhook retry logic
```

### PR checklist

Before opening a PR, run locally:

```bash
pnpm lint
pnpm test
pnpm build
```

Use Postgres and `RUN_DB_INTEGRATION_TESTS=true` when you change API behavior covered by integration tests.

When you open the PR, confirm:

- [ ] Tests pass
- [ ] Lint passes
- [ ] Build succeeds
- [ ] Documentation updated (if needed)
- [ ] New code follows the existing style
- [ ] No breaking changes (or called out clearly in the PR description)

CI on `main` runs the same checks (see [.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Code of conduct

Participation is governed by the [Contributor Covenant](CODE_OF_CONDUCT.md). Please read it before contributing.

## Security

Do **not** open public issues for undisclosed vulnerabilities. See [SECURITY.md](SECURITY.md).
