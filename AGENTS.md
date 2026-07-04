# AGENTS.md

## Cursor Cloud specific instructions

Telemetry Tracker is a pnpm monorepo with three runtime services. Standard dev/lint/test/build commands live in `README.md`, `CONTRIBUTING.md`, and root `package.json` scripts — use those. The notes below only cover cloud-VM specifics and non-obvious gotchas.

### Services

| Service | Start command | Port |
|---------|---------------|------|
| PostgreSQL 16 | `sudo pg_ctlcluster 16 main start` | 5432 |
| API (Fastify) | `pnpm dev:api` | 3001 |
| Dashboard (Next.js) | `pnpm dev:dashboard` | 3000 |

The dashboard reads all telemetry through the API (`API_URL`, default `http://localhost:3001`); the API needs Postgres (`DATABASE_URL`).

### Startup gotchas

- **Postgres runs as a native local install, not Docker.** Ignore the `docker compose up` step in the README on this VM; instead start the cluster with `sudo pg_ctlcluster 16 main start`. It is not auto-started on boot. The database is `telemetry` with user/password `postgres`/`postgres`.
- **`.env` files are required and gitignored.** If missing, recreate them: `cp apps/api/.env.example apps/api/.env` and `cp apps/dashboard/.env.example apps/dashboard/.env`. The defaults already point at the local Postgres.
- **Migrations: prefer `pnpm --filter api exec prisma migrate deploy`** (non-interactive). `pnpm db:migrate` runs `prisma migrate dev`, which can hang or prompt in a non-interactive shell.

### Testing gotcha

- DB integration tests need `DATABASE_URL` exported as an environment variable — `NODE_ENV=test` does **not** load `apps/api/.env`. Run:
  ```bash
  export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/telemetry
  RUN_DB_INTEGRATION_TESTS=true pnpm test
  ```
  Without these, the api Prisma integration tests fail with `Environment variable not found: DATABASE_URL`. `pnpm lint` and `pnpm build` need no special env.
