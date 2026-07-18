# Alert rules

Configurable notification rules per project ([#493](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/493); milestone **v1.15.x — Alert Rules**).

## Separation of concerns

| Capability | Owns | Does not own |
| --- | --- | --- |
| **Alert Rules** (this doc / #493) | When to fire: `Condition[]` (AND), thresholds/windows, cooldown dedupe, opaque `destinationIds` bindings | Provider send logic, channel CRUD, email templates |
| **Notifications** (v1.14 / [#492](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/492)) | Delivery: Notification Center, email fan-out, Slack/Discord/Teams/Telegram/webhooks via `fireProjectAlert` / enqueue workers | Rule authoring / condition evaluation |

Rules **must not** embed provider-specific send paths. On match they call into existing dispatch (`fireProjectAlert`), which resolves destination ids to email and/or `ProjectWebhook` deliveries.

Built-in spike/quota thresholds on `Project.alert_settings` remain supported until a later integration slice migrates them into `AlertRule` rows.

## Model

| Field | Purpose |
| --- | --- |
| `conditions` | JSON **array** of condition objects — **AND** semantics (every *known* condition must match) |
| `destination_ids` | JSON array of **opaque** destination ids (not `email`/`slack`/… provider enums) |
| `cooldown_minutes` | Minimum minutes between successful fires (enforced via `last_fired_at`) |
| `last_fired_at` | Set atomically on fire claim; null until the first successful claim |
| `enabled` / `deleted_at` | Toggle and soft-delete |

### Conditions (`Condition[]`)

Supported kinds (#534):

| Type | Meaning | Path |
| --- | --- | --- |
| `ERROR_COUNT` | Error occurrences ≥ threshold in window | Ingest |
| `ERROR_RATE` | `(errors / sessions) × 100` ≥ threshold percent (requires sessions &gt; 0) | Ingest + scheduled |
| `SESSION_DROP` | Sessions dropped ≥ percent vs previous equal window | Scheduled |
| `NEW_ERROR_GROUP` | ≥1 `ErrorGroup` with `first_seen` in window | Ingest |
| `AFFECTED_USERS` | Distinct non-null `user_id` on occurrences ≥ threshold | Ingest |
| `QUOTA_PERCENT` | Monthly ingest usage ≥ percent of plan limit | Scheduled |
| `NO_EVENTS` | Zero `Event` rows in window | Scheduled |
| `HEARTBEAT` | Zero events, sessions, and error occurrences in window | Scheduled |

Optional `environment` (where present) filters ingest/environment-scoped rows — for errors this is `ErrorOccurrence.environment` (set at ingest), not the mutable last-seen tag on `ErrorGroup`.

```json
{
  "conditions": [
    {
      "type": "ERROR_COUNT",
      "threshold": 25,
      "windowMinutes": 15,
      "environment": "production"
    },
    {
      "type": "HEARTBEAT",
      "windowMinutes": 30
    }
  ]
}
```

Multiple conditions are ANDed. Unknown / unsupported `type` values are **skipped** (diagnostic log); they never crash evaluation or fail the AND group. If no supported conditions remain after filtering, the rule does not fire.

### Destinations (opaque ids)

```json
{
  "destinationIds": ["project-email", "<ProjectWebhook uuid>", "…"]
}
```

| Id | Resolved by Notifications to |
| --- | --- |
| `project-email` | Project alert email fan-out (`fireProjectAlert` email path) |
| `ProjectWebhook.id` | That delivery channel (Slack / Discord / Teams / Telegram / generic webhook — provider is on the webhook row, not the rule) |

Rules store ids only. Provider awareness lives in Notifications / Delivery channel configuration.

## Evaluation

### Ingest-triggered

On successful error ingest, `maybeEvaluateAlertRules` runs alongside the built-in spike/quota hooks for rules that include at least one ingest condition (`ERROR_COUNT`, `ERROR_RATE`, `NEW_ERROR_GROUP`, `AFFECTED_USERS`). Matching rules call `fireProjectAlert` with `rule: ALERT_RULE` after resolving `destinationIds` → `{ email, webhookIds }` at the Notifications boundary.

### Scheduled evaluator

Conditions that are not naturally ingest-triggered (`HEARTBEAT`, `NO_EVENTS`, `SESSION_DROP`, `QUOTA_PERCENT`, and `ERROR_RATE`) are evaluated by the scheduled job:

```bash
pnpm --filter api alert-rules-evaluator
# production: node dist/jobs/run-alert-rules-evaluator.js
```

- One sweep then exit (Railway cron) by default; `--loop` sleeps between ticks.
- Cadence is configured in **one place**: `ALERT_RULES_SCHEDULE_INTERVAL_MINUTES` (default **5**; constant `ALERT_RULES_SCHEDULE_INTERVAL_MINUTES` in `apps/api/src/lib/alert-rules.ts`).
- Soft-deleted projects and soft-deleted organizations are skipped (same gate as ingest API-key auth).
- Cooldown is elapsed time since `last_fired_at` (atomic claim so overlapping sweeps cannot double-fire). `alert:rule:{id}:{claimedAtMs}` is only the `AlertEvent` idempotency key after a successful claim.
- Coexists with ingest evaluation: schedule-only rules are skipped on ingest; ingest-only rules are skipped on the schedule path; mixed rules are evaluated on both paths with full AND semantics.

See [RAILWAY.md](./RAILWAY.md#alert-rules-evaluator-cron).

## API

- `GET/POST /api/project/alert-rules`
- `PATCH/DELETE /api/project/alert-rules/:ruleId`

Create body shape:

```json
{
  "name": "Production error spike",
  "conditions": [{ "type": "ERROR_COUNT", "threshold": 25, "windowMinutes": 15 }],
  "destinationIds": ["project-email"],
  "cooldownMinutes": 15
}
```

Editor/owner required for mutations (same as alert settings / webhooks). Cap: `MAX_ALERT_RULES` (20) per project.

## Dashboard

Alerts → **Custom rules**: create, **edit**, enable/disable, remove; multi-condition editor (AND, up to `MAX_CONDITIONS_PER_RULE`); bind opaque destination ids (email + Delivery channels) with clear copy that Notifications owns delivery. The form currently authors **`ERROR_COUNT`** conditions; other kinds from the API are listed/summarized and can be toggled or removed (full editor UX for those kinds is follow-up).

## Milestone slices (v1.15.x)

Parent vision: [#493](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/493). Prefer small reviewable PRs over a mega-ship.

| Slice | Issue |
| --- | --- |
| Foundation (this model + ERROR_COUNT + MVP UI) | [#532](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/532) / [PR #531](https://github.com/Telemetry-Tracker/telemetry-tracker/pull/531) |
| Dashboard multi-condition / edit UX | [#533](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/533) |
| Additional conditions + scheduled evaluation | [#534](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/534) |
| Integrate built-in spike/quota into AlertRule | [#535](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/535) |
| Release v1.15.0 | [#536](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/536) |
