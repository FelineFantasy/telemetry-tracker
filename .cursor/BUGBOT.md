# Telemetry Tracker — Bugbot review rules

Monorepo: Fastify API (`apps/api`), Next.js dashboard (`apps/dashboard`), npm SDKs (`packages/telemetry-*`). Feature PRs target **`develop`**; production releases promote **`develop` → `main`**. See [docs/RELEASE.md](../docs/RELEASE.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

## Tone

- Report **bugs, security issues, and data-loss risks** with clear repro reasoning.
- Prefer **actionable** findings over style nits.
- Do **not** block on pre-existing patterns in unchanged lines.
- Do **not** ask for CHANGELOG updates for test-only or internal refactors.

## Always flag (blocking)

### Security and tenancy

- Enabling or weakening ingest auth in production (`INGEST_ALLOW_UNAUTHENTICATED`, skipping API key verification).
- Dashboard **mutations** or sensitive reads without session auth in code paths reachable in production.
- Cross-tenant data access: queries missing `project_id` / org membership checks on telemetry or billing rows.
- Logging or returning API key secrets, session tokens, or raw Stripe webhook payloads.
- SQL injection via unsanitized user input in `$queryRaw` (prefer Prisma parameterized APIs).

### Database

- Prisma schema changes **without** a matching migration under `apps/api/prisma/migrations/`.
- Destructive migrations (column/table drops) without a **Breaking** or **Database** note expectation in CHANGELOG.
- New required env vars without `.env.example` updates.

### Notifications, alerts, and billing (high-risk domain)

Recent production bugs lived here — review cross-file carefully:

1. **Dual routing**: In-app items use categories `issues`, `billing`, `team`, `alerts` ([notification-preferences.ts](../apps/api/src/lib/notification-preferences.ts)). `quota` and `billing` types route to **billing**; `alert` type routes to **alerts**. A change that builds both session `quota` items and fired `alert` rows with the **same dedupe id** must respect [dedupeNotificationItems](../apps/api/src/lib/dashboard-notifications.ts) routing preferences — billing-only users must keep `quota` items; alerts-only users must keep `alert` items.

2. **Quota threshold parity**: Session `usageQuota.nearQuota` ([dashboard-session-context.ts](../apps/api/src/lib/dashboard-session-context.ts)) must use project `alert_settings.quota.nearPercent` via `quotaNearRatio`, **not** a hardcoded 90%. Ingest alerts ([quota-alert.ts](../apps/api/src/lib/quota-alert.ts)) must use the same threshold.

3. **QUOTA_EXCEEDED is unconditional**: `maybeNotifyQuotaAlerts` must fire `QUOTA_EXCEEDED` when `used >= limit` even if `quota.enabled` is false. Only `QUOTA_NEAR` is gated by `quota.enabled`. UI copy in Alerts settings states exceeded alerts always fire.

4. **Bell feed completeness**: [recentAlertNotifications](../apps/api/src/lib/alert-dispatch.ts) must include fired quota alert events (`QUOTA_NEAR`, `QUOTA_EXCEEDED`), not only `ERROR_SPIKE`, so alerts-routing users see them in the bell.

5. **Alert href**: Persist or derive correct in-app links (`alertEventHref`, `AlertEvent.href`) — error spikes → `/dashboard/errors` or specific group; quota → `/dashboard/settings/billing`.

6. **Alert webhooks**: Outbound `ProjectWebhook` URLs must be HTTPS-only; list APIs must not leak full URLs or signing secrets; delivery log list must mask URLs the same way; `fireProjectAlert` must still succeed if webhook delivery fails (enqueue PENDING rows; worker handles POST/retry). Delivery must DNS-resolve and pin-connect to validated IPs (no rebinding TOCTOU). Delivery must re-resolve DNS and block private/loopback targets (not hostname-string checks alone). Test webhook failures must not be logged as `DEAD`. Test webhooks must persist the delivery row before the outbound POST and always finalize to `SUCCESS`/`FAILED` (retry + last-resort FAILED — never leave `PROCESSING`, since the worker will not reclaim `webhook:test:%`). Worker claim must exclude `webhook:test:%` dedupe keys so expired test PROCESSING leases are never reclaimed for a second POST or a generic payload. Worker must not POST when `alert_event_id` is null. Worker must renew the claim lease before POST; lease duration must be at least the HTTPS POST timeout; after a successful POST, finalize `SUCCESS` even if the lease-scoped complete misses (retry + last-resort force SUCCESS by id — never leave reclaimable `PROCESSING` after HTTP success). `MAX_PROJECT_WEBHOOKS` must be enforced atomically (not check-then-insert). Optional `destinations.webhookIds` on fire must not enqueue unrelated project webhooks; `destinations.email: false` must skip email.

7. **Alert rules (#493 / #534)**: Custom `AlertRule` rows are project-scoped (soft-delete); `conditions[]` (AND) + opaque `destinationIds` (not provider enums); webhook uuids in destination ids must belong to the project; rules only call `fireProjectAlert` (Notifications owns delivery); ingest path + scheduled evaluator coexist without removing built-in spike/quota hooks; unknown condition types are skipped (do not fail AND; do not crash); rules with no supported conditions must not fire; cooldown dedupe applies on both paths; unparsable/empty `conditions` must still list in the Alerts UI; `ERROR_COUNT` environment scope must match trimmed `ErrorOccurrence.environment` from ingest; schedule cadence is `ALERT_RULES_SCHEDULE_INTERVAL_MINUTES` only.

### Plan enforcement and ingest

- Rejecting ingest at quota cap must still trigger quota exceeded notification paths when appropriate.
- Usage metering (`addIngestUnits`) must stay consistent with plan limit checks in `assertIngestPlanOrReply`.
- RPS limits must not be consumed when monthly quota already blocks the batch.

## Flag when applicable (quality)

- API lib changes under `apps/api/src/lib/` without corresponding Vitest coverage when behavior is non-trivial.
- Dashboard server-only code (`next/headers`, Prisma, cookies) imported into `"use client"` modules or shared `lib/` files used by client components — split into `*-server.ts` pattern (see `alert-settings-server.ts`).
- User-facing dashboard/API behavior changes without `[Unreleased]` entry in [CHANGELOG.md](../CHANGELOG.md).
- RBAC violations vs [docs/RBAC.md](../docs/RBAC.md) (e.g. VIEWER allowed to revoke keys).

## Ignore / do not report

- `node_modules/`, `dist/`, `.next/`, coverage output, lockfile-only diffs unless license/compliance issue.
- Formatting-only changes that pass `pnpm lint`.
- Marketing copy and README unless factually wrong about security or deployment.
- Missing tests for trivial renames or comment-only edits.

## Pre-merge expectations

Contributors should run locally before opening PRs:

```bash
pnpm lint && pnpm test && pnpm build
```

For notification, alert, billing, ingest, or auth changes, recommend running **`/review-bugbot`** in Cursor before push so GitHub Bugbot can skip duplicate review of the same diff.
