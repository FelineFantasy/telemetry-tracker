# API (`apps/api`) — Bugbot rules

Fastify + Prisma + PostgreSQL. Ingest uses **API keys**; dashboard uses **sessions**. See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md).

## Ingest (`src/routes/ingest.ts`, `src/middleware/ingest-auth.ts`)

- Every write path must resolve `projectId` from authenticated API key, not from client-supplied body alone.
- Validate payloads with Zod; reject oversize or malformed batches safely.
- After successful ingest that approaches/exceeds quota, async notification hooks (`maybeNotifyQuotaAlerts`, `maybeNotifyErrorSpike`, `maybeEvaluateAlertRules`) must remain wired — do not remove side effects when refactoring plan checks.
- `assertIngestPlanOrReply` failure paths: distinguish already-at-cap vs batch-would-exceed; only notify exceeded when usage is actually at/above limit.

## Plan enforcement (`src/lib/plan-enforcement.ts`, `usage-meter.ts`)

- `monthlyIngestUnits` limits must match [docs/ENTITLEMENTS.md](../../docs/ENTITLEMENTS.md) tier definitions.
- Free-tier and paid-tier edge cases: zero limit, missing `UsageMonthly` row, deleted org/project must not throw unhandled errors on ingest.

## Notifications and alerts

Files: `dashboard-notifications.ts`, `notification-preferences.ts`, `notification-email-dispatch.ts`, `alert-dispatch.ts`, `alert-webhook-dispatch.ts`, `alert-rules.ts`, `quota-alert.ts`, `error-spike-alert.ts`, `project-alert-settings.ts`.

- **Category mapping**: `categoryForNotificationType` — never route `alert` items to billing or vice versa without updating both build and filter paths.
- **Dedupe by id**: `quota:near:{projectId}:{YYYY-MM}` and `quota:exceeded:…` keys are shared between session items and `AlertEvent.dedupe_key`. Collisions must use routing-aware dedupe (pass `preferences` into `dedupeNotificationItems`).
- **Email vs in-app**: `shouldShowInAppNotification` and `shouldSendEmailForCategory` must stay aligned when adding new notification types.
- **fireProjectAlert**: unique constraint on `dedupe_key` is intentional — do not swallow non-P2002 errors. After a successful insert, fan out to email (best-effort) and **await** `enqueueAlertWebhookDeliveries` so PENDING rows exist before return; delivery is performed by `alert-webhook-worker` (claim/lease), not in-process fire-and-forget. Optional `destinations` may skip email (`email: false`) and/or limit webhooks (`webhookIds`); omit `webhookIds` for legacy “all enabled webhooks”.
- **Alert rules (#493 / #534)**: `AlertRule` CRUD must scope by `project_id` + `deleted_at: null`; store `conditions` (AND) + opaque `destination_ids` (not provider enums); webhook uuids in `destination_ids` must belong to the same project; resolve ids via `resolveDestinationIds` → `fireProjectAlert` only (no provider send logic in rules); cap with `MAX_ALERT_RULES` via atomic count+insert; evaluate ingest conditions on error ingest (`maybeEvaluateAlertRules`) and schedule-oriented conditions via `runScheduledAlertRuleEvaluation` / `alert-rules-evaluator` job — without removing built-in `maybeNotifyErrorSpike` / `maybeNotifyQuotaAlerts`; unknown condition `type` values must be **skipped** (never crash AND evaluation); rules with no remaining supported conditions must not fire; cooldown dedupe must apply on both paths. `ERROR_COUNT` / error-scoped environment filters must use `ErrorOccurrence.environment` (populated at ingest), never the mutable last-seen `ErrorGroup.environment`. Schedule cadence is `ALERT_RULES_SCHEDULE_INTERVAL_MINUTES` only.
- **Webhooks**: only `https:` URLs; never return raw URL or signing secret on list/GET (mask URL; secret only on create/rotate). Soft-delete with `deleted_at`. Cap destinations per project (`MAX_PROJECT_WEBHOOKS`) with an atomic count+insert (serializable tx). Resolve DNS and reject private/loopback/link-local addresses before each delivery POST, and **pin the TCP connect** to a validated IP (do not `fetch(url)` after a separate lookup). Delivery-time DNS is bounded by `WEBHOOK_DNS_TIMEOUT_MS`. Worker must renew the lease before POST; lease duration must be ≥ DNS timeout + HTTPS POST timeout **plus a margin** (`WEBHOOK_LEASE_POST_MARGIN_MS`) so reclaim cannot race a slow resolver or response; if renew misses, best-effort `releaseAlertWebhookDeliveryClaim` (clear PROCESSING, undo attempt increment, retry immediately) so a still-owned row is not stuck until lease expiry; after a successful POST, finalize `SUCCESS` even if the lease-scoped complete misses (retry + last-resort force SUCCESS by id — never leave reclaimable `PROCESSING`). Persist test delivery rows before POST; always finalize test rows to `SUCCESS`/`FAILED` (retry + last-resort FAILED — never leave `PROCESSING`, since the worker will not reclaim `webhook:test:%`). Worker claim must exclude `webhook:test:%` dedupe keys (test rows use PROCESSING + lease but are single-shot — never reclaim/re-POST); instead `abandonExpiredTestWebhookDeliveries` terminalizes expired test PROCESSING rows as `FAILED` without POSTing. Do not POST a generic payload when `alert_event_id` is null — fail the delivery. `DEAD` is only for exhausted retries; single-shot test deliveries use `FAILED`.
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
