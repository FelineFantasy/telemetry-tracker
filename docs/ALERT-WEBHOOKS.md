# Alert webhooks

Project-scoped HTTPS webhooks receive JSON when Telemetry Tracker fires an alert
(`ERROR_SPIKE`, `QUOTA_NEAR`, `QUOTA_EXCEEDED`) via `fireProjectAlert`.

Configure destinations under **Dashboard → Alerts → Delivery** (owners/editors).
Up to **5** webhooks per project. Slack/Discord/Teams incoming webhooks work as DIY
destinations until first-party channel UIs ship.

- URLs must be `https:` and must not target loopback, private, or link-local hosts
  (create/update string checks).
- At delivery time the worker **resolves DNS**, rejects private/loopback/link-local
  **IPv4 and IPv6** answers, and **pins the HTTPS connect** to a validated address
  (custom `lookup` + TLS SNI / `Host` for the original hostname) so a rebinding race
  cannot retarget the socket after validation.
- Delivery POSTs do not follow redirects (`https.request` does not auto-follow).

## Payload

```json
{
  "version": 1,
  "event": "alert.fired",
  "deliveryId": "uuid",
  "firedAt": "2026-07-17T10:00:00.000Z",
  "projectId": "…",
  "rule": "ERROR_SPIKE",
  "title": "Error spike detected",
  "body": "42 errors in the last 15 minutes (threshold 25).",
  "href": "https://your-dashboard.example/dashboard/errors",
  "dedupeKey": "alert:error_spike:…:15:…"
}
```

`href` is absolutized when `DASHBOARD_ORIGIN` (or equivalent) is configured on the API;
otherwise it may be a path like `/dashboard/errors`.

`deliveryId` is the durable `AlertWebhookDelivery.id` (stable across retries).

## Headers

| Header | Value |
|--------|--------|
| `Content-Type` | `application/json` |
| `User-Agent` | `TelemetryTracker-Webhooks/1.0` |
| `X-Telemetry-Event` | `alert.fired` |
| `X-Telemetry-Delivery` | Same UUID as `deliveryId` |
| `X-Telemetry-Signature` | `sha256=<hex>` when a signing secret is set |

Verify signatures with HMAC-SHA256 over the **raw request body** using the secret
shown once when the webhook is created.

## Delivery semantics

- Fired only after a new `AlertEvent` row is inserted (dedupe key unique per project).
- `fireProjectAlert` **awaits** inserting `PENDING` `AlertWebhookDelivery` rows for each
  enabled webhook, then returns (survives API process restart).
- Run the worker (same Postgres claim/lease pattern as brief generation):

  ```bash
  pnpm --filter api alert-webhook-worker          # poll loop
  pnpm --filter api alert-webhook-worker -- --once  # single delivery
  ```

  Env: `ALERT_WEBHOOK_WORKER_POLL_MS` (default `1000`),
  `ALERT_WEBHOOK_WORKER_LEASE_MS` (default `30000`).

- Worker flow: claim (`FOR UPDATE SKIP LOCKED` + lease) → DNS/IP validate + pin →
  POST → record outcome → retry with short backoff (`FAILED` + `next_attempt_at`) or
  terminal `DEAD` after **2** attempts.
- Operators can browse recent rows under **Alerts → Delivery** (read access for
  project members; same auth as alert history). Optionally filter via
  `GET /api/project/webhook-deliveries?webhookId=…`.
- Use **Test** on the Alerts page to POST a sample payload immediately (not queued);
  a failed test is logged as `FAILED` (single-shot).

## Related

- Parent notifications vision: GitHub #492
- This channel: #225
- Slack / Discord first-party UIs: #223 / #224
- In-product Notification Center: #508
- Configurable alert rules engine: #493 (priority 2)
