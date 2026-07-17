# Alert webhooks

Project-scoped HTTPS webhooks receive JSON when Telemetry Tracker fires an alert
(`ERROR_SPIKE`, `QUOTA_NEAR`, `QUOTA_EXCEEDED`) via `fireProjectAlert`.

Configure destinations under **Dashboard → Alerts → Delivery** (owners/editors).
Up to **5** webhooks per project. Slack/Discord/Teams incoming webhooks work as DIY
destinations until first-party channel UIs ship.

- URLs must be `https:` and must not target loopback, private, or link-local hosts.
- Delivery POSTs use `redirect: "manual"` so a 3xx cannot bounce the request to an
  internal host after create-time validation.

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
- Best-effort: up to **2** attempts with a short backoff; failures are recorded in
  `AlertWebhookDelivery` (`FAILED` then `DEAD`).
- Operators can browse recent attempts under **Alerts → Delivery** (read access for
  project members; same auth as alert history). Optionally filter via
  `GET /api/project/webhook-deliveries?webhookId=…`.
- Use **Test** on the Alerts page to POST a sample payload without waiting for a real spike.

## Related

- Parent notifications vision: GitHub #492
- This channel: #225
- Slack / Discord first-party UIs: #223 / #224
- In-product Notification Center: #508
- Configurable alert rules engine: #493 (priority 2)
