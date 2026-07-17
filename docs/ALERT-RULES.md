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
| `conditions` | JSON **array** of condition objects — **AND** semantics (every condition must match) |
| `destination_ids` | JSON array of **opaque** destination ids (not `email`/`slack`/… provider enums) |
| `cooldown_minutes` | Dedupe bucket so a rule fires at most once per cooldown window |
| `enabled` / `deleted_at` | Toggle and soft-delete |

### Conditions (`Condition[]`)

Only **ERROR_COUNT** is evaluated in this release. Optional `environment` filters on
`ErrorOccurrence.environment` (set at ingest), not the mutable last-seen tag on `ErrorGroup`.

```json
{
  "conditions": [
    {
      "type": "ERROR_COUNT",
      "threshold": 25,
      "windowMinutes": 15,
      "environment": "production"
    }
  ]
}
```

Multiple conditions are ANDed. Unknown / unimplemented `type` values cause the rule to be skipped (no crash).

Documented for later (not implemented yet): error rate %, session drop, new error group + affected users, quota usage %, heartbeat (no events for N minutes).

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

On successful error ingest, `maybeEvaluateAlertRules` runs alongside the built-in spike/quota hooks. Matching rules call `fireProjectAlert` with `rule: ALERT_RULE` after resolving `destinationIds` → `{ email, webhookIds }` at the Notifications boundary.

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

Alerts → **Custom rules**: create, enable/disable, remove; bind opaque destination ids (email + Delivery channels). Multi-condition editor UX is a follow-up slice — the API already accepts `conditions[]`.

## Milestone slices (v1.15.x)

Parent vision: [#493](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/493). Prefer small reviewable PRs over a mega-ship.

| Slice | Issue |
| --- | --- |
| Foundation (this model + ERROR_COUNT + MVP UI) | [#532](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/532) / [PR #531](https://github.com/Telemetry-Tracker/telemetry-tracker/pull/531) |
| Dashboard multi-condition / edit UX | [#533](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/533) |
| Additional conditions + scheduled evaluator | [#534](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/534) |
| Integrate built-in spike/quota into AlertRule | [#535](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/535) |
| Release v1.15.0 | [#536](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/536) |
