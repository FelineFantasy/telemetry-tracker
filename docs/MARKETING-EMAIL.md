# Marketing / release email list

Product update emails for the hosted cloud: footer subscribe form, registration opt-in, and a manual release send script.

## Data model

`MarketingSubscriber` stores:

| Field | Purpose |
|-------|---------|
| `email` | Unique subscriber address |
| `source` | `subscribe_form` or `registration` |
| `subscribed_at` | First subscription time |
| `unsubscribed_at` | Set on one-click unsubscribe |
| `consent_at` | Last consent timestamp (GDPR) |
| `consent_metadata` | Consent label, version, optional IP / user agent |
| `unsubscribe_token` | SHA-256 hash of opaque one-click token |

## Public API

| Endpoint | Description |
|----------|-------------|
| `POST /api/marketing/subscribe` | `{ "email": "you@example.com" }` — footer / contact form |
| `POST /api/marketing/unsubscribe` | `{ "token": "<opaque>" }` — linked from emails; dashboard `/unsubscribe?token=…` calls this |

Both routes use the public rate limit surface (`RATE_LIMIT_PUBLIC_MAX`).

## Registration opt-in

`POST /api/auth/register` accepts `marketingOptIn` (default **true** when omitted). The dashboard registration checkbox is **on by default** with explicit copy; unchecking sends `marketingOptIn: false` and **does not** add the address to the list.

## Sending a release email (MVP)

Requires Resend (`RESEND_API_KEY`, `TELEMETRY_EMAIL_FROM`) and `TELEMETRY_DASHBOARD_ORIGIN` for unsubscribe links.

From the repo root, after applying migrations:

```bash
cd apps/api
pnpm exec tsx scripts/send-release-email.ts --dry-run
pnpm exec tsx scripts/send-release-email.ts --version=1.4.1
```

- Default `--version=Unreleased` reads the `[Unreleased]` section from `CHANGELOG.md`.
- `--dry-run` prints the recipient count without sending.
- Before each send, the script rotates the one-click unsubscribe token **for that recipient only**, immediately before attempting delivery.

### First production send checklist

1. Merge migration `20260703140000_marketing_subscriber` and deploy API.
2. Confirm Resend domain and `TELEMETRY_EMAIL_FROM` (see [BILLING.md](./BILLING.md)).
3. Set `TELEMETRY_DASHBOARD_ORIGIN=https://telemetry-tracker.com` on the API.
4. Finalize the target version section in `CHANGELOG.md` on `main` (or pass `--version=Unreleased` for a preview).
5. Run `--dry-run`, verify subscriber count.
6. Run without `--dry-run` from a secure operator machine with production `DATABASE_URL`.
7. Spot-check inbox rendering and the unsubscribe link.

Full automation on git tag can be added later (GitHub Action calling the same script).

## Privacy

Hosted cloud privacy policy covers product update emails, consent, and unsubscribe. Cookie policy is unchanged — marketing email is not cookie-based tracking.
