# API (`apps/api`) — Bugbot rules

Fastify + Prisma + PostgreSQL. Ingest uses **API keys**; dashboard uses **sessions**. See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## Ingest (`src/routes/ingest.ts`, `src/middleware/ingest-auth.ts`)

- Every write path must resolve `projectId` from authenticated API key, not from client-supplied body alone.
- Validate payloads with Zod; reject oversize or malformed batches safely.
- After successful ingest that approaches/exceeds quota, async notification hooks (`maybeNotifyQuotaAlerts`, `maybeNotifyErrorSpike`) must remain wired — do not remove side effects when refactoring plan checks.
- `assertIngestPlanOrReply` failure paths: distinguish already-at-cap vs batch-would-exceed; only notify exceeded when usage is actually at/above limit.

## Plan enforcement (`src/lib/plan-enforcement.ts`, `usage-meter.ts`)

- `monthlyIngestUnits` limits must match [docs/ENTITLEMENTS.md](../../docs/ENTITLEMENTS.md) tier definitions.
- Free-tier and paid-tier edge cases: zero limit, missing `UsageMonthly` row, deleted org/project must not throw unhandled errors on ingest.

## Notifications and alerts

Files: `dashboard-notifications.ts`, `notification-preferences.ts`, `notification-email-dispatch.ts`, `alert-dispatch.ts`, `quota-alert.ts`, `error-spike-alert.ts`, `project-alert-settings.ts`.

- **Category mapping**: `categoryForNotificationType` — never route `alert` items to billing or vice versa without updating both build and filter paths.
- **Dedupe by id**: `quota:near:{projectId}:{YYYY-MM}` and `quota:exceeded:…` keys are shared between session items and `AlertEvent.dedupe_key`. Collisions must use routing-aware dedupe (pass `preferences` into `dedupeNotificationItems`).
- **Email vs in-app**: `shouldShowInAppNotification` and `shouldSendEmailForCategory` must stay aligned when adding new notification types.
- **fireProjectAlert**: unique constraint on `dedupe_key` is intentional — do not swallow non-P2002 errors.
- **Alert settings defaults**: changes to `DEFAULT_PROJECT_ALERT_SETTINGS` affect all projects with null/invalid JSON — treat as user-facing.

## Routes (`src/routes/`)

- New dashboard routes: enforce org/project membership and role via existing permission helpers (`org-permissions.ts`).
- PATCH/POST handlers must return consistent error shapes (`401` vs `403` vs `404`).
- Integration-sensitive routes: if behavior changes, flag missing update to tests run with `RUN_DB_INTEGRATION_TESTS=true`.

## Prisma

- Schema changes require migrations; update `schema.prisma` and `migrations/` together.
- New indexes on hot paths (`error_occurrence`, `event`, ingest tables) for query patterns introduced in the PR.
- Soft-delete filters (`deleted_at: null`) must remain on org/project scoped reads.

## Tests

- Prefer unit tests in `src/lib/*.test.ts` with mocked Prisma for notification/alert logic.
- When adding routes, extend existing test patterns — do not leave `alertEvent` or `usageMonthly` mocks undefined in dashboard notification tests.
