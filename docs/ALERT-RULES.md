# Alert rules

Configurable notification rules per project ([#493](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/493)).

Built-in spike/quota thresholds on `Project.alert_settings` remain supported. Custom **AlertRule** rows add an extensible condition model with destination binding.

## Model

| Field | Purpose |
| --- | --- |
| `condition_type` | Discriminator (`ERROR_COUNT` today; more kinds later) |
| `condition` | JSON params for the condition |
| `destinations` | `{ email: boolean, webhookIds: string[] }` — binds email fan-out and specific Delivery channels |
| `cooldown_minutes` | Dedupe bucket so a rule fires at most once per cooldown window |
| `enabled` / `deleted_at` | Toggle and soft-delete |

### Condition examples (extensible)

Only **ERROR_COUNT** is evaluated in this release:

```text
IF error count ≥ threshold in windowMinutes [AND environment = X]
→ destinations (email and/or selected Slack/Discord/Teams/Telegram/webhook ids)
```

Documented for later (not implemented yet): error rate %, session drop, new error group + affected users, quota usage %, heartbeat (no events for N minutes).

## Evaluation

On successful error ingest, `maybeEvaluateAlertRules` runs alongside the built-in spike/quota hooks. Matching rules call `fireProjectAlert` with `rule: ALERT_RULE` and destination filters. Webhook enqueue respects `webhookIds`; email is skipped when `destinations.email` is false.

## API

- `GET/POST /api/project/alert-rules`
- `PATCH/DELETE /api/project/alert-rules/:ruleId`

Editor/owner required for mutations (same as alert settings / webhooks). Cap: `MAX_ALERT_RULES` (20) per project.

## Dashboard

Alerts → **Custom rules**: create, enable/disable, remove; bind email + Delivery destinations.
