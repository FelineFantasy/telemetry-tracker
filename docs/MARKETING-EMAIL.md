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

## When to send (maintainer policy)

Product update emails are **manual** today — nothing in CI or cron sends them automatically.

| Release type | Send? | Notes |
|--------------|-------|-------|
| **MINOR** or **MAJOR** on `main` | **Yes** | Typical milestone releases with user-facing `Added` / `Changed` in [CHANGELOG.md](../CHANGELOG.md) |
| **PATCH** (hotfix) | **Usually no** | Skip routine bugfix-only patches; send only if the fix is user-visible and worth announcing |
| Pre-release / draft | **No** | Use `--dry-run` and `--version=Unreleased` to preview copy only |

Align semver bumps with [RELEASE.md](./RELEASE.md#semver-guidance). If a release has no subscriber-relevant bullets (migrations-only, internal ops), skip the email.

**There is no send audit log in the database.** The operator console output (`Sent N/M release email(s)`) is the only record — keep a note in the GitHub Release or milestone when email went out.

### Maintainer workflow (each qualifying release)

Do this **after** the GitHub Release is published and production is verified — see step 8 in [RELEASE.md](./RELEASE.md#on-main-after-promotion).

1. Confirm `CHANGELOG.md` on `main` has a finalized `## [X.Y.Z]` section for the tag you just shipped.
2. From a secure machine with production `DATABASE_URL`, Resend, and dashboard origin configured:
   ```bash
   cd apps/api
   pnpm exec tsx scripts/send-release-email.ts --dry-run --version=X.Y.Z
   pnpm exec tsx scripts/send-release-email.ts --version=X.Y.Z
   ```
3. Spot-check one inbox (rendering + unsubscribe link).
4. Note in the GitHub Release body or milestone: “Product update email sent to N subscribers on YYYY-MM-DD.”

### v1.4.2 backfill (one-time)

v1.4.2 shipped the subscriber list and release script but **no automated send ran** — subscribers have not received a product update email yet. Send once when ready:

```bash
cd apps/api
pnpm exec tsx scripts/send-release-email.ts --dry-run --version=1.4.2
pnpm exec tsx scripts/send-release-email.ts --version=1.4.2
```

Skip separate emails for v1.4.0 / v1.4.1 unless you deliberately want historical catch-up; start the cadence from v1.4.2.

## Sending a release email (MVP)

Requires Resend (`RESEND_API_KEY`, `TELEMETRY_EMAIL_FROM`) and `TELEMETRY_DASHBOARD_ORIGIN` for unsubscribe links.

```bash
cd apps/api
pnpm exec tsx scripts/send-release-email.ts --help
pnpm exec tsx scripts/send-release-email.ts --dry-run --version=1.4.2
pnpm exec tsx scripts/send-release-email.ts --version=1.4.2
```

- `--version=X.Y.Z` reads that section from `CHANGELOG.md` (repo root). Required for a live send; omit only with `--dry-run` to preview `[Unreleased]`.
- `--dry-run` prints subject, recipient count, and a short CHANGELOG preview without sending.
- Before each send, the script rotates the one-click unsubscribe token **for that recipient only**, immediately before attempting delivery.

### First production send checklist

1. Merge migration `20260703140000_marketing_subscriber` and deploy API.
2. Confirm Resend domain and `TELEMETRY_EMAIL_FROM` (see [BILLING.md](./BILLING.md)).
3. Set `TELEMETRY_DASHBOARD_ORIGIN=https://telemetry-tracker.com` on the API.
4. Finalize the target version section in `CHANGELOG.md` on `main`.
5. Run `--dry-run --version=X.Y.Z`, verify subscriber count and subject line.
6. Run with `--version=X.Y.Z` (no `--dry-run`) from a secure operator machine with production `DATABASE_URL`.
7. Spot-check inbox rendering and the unsubscribe link.

### Automation (future)

Full automation on git tag is **not implemented**. A GitHub Action could call the same script with production secrets; until then, treat product update email as a required manual step in [RELEASE.md](./RELEASE.md) for MINOR+ releases.

## Privacy

Hosted cloud privacy policy covers product update emails, consent, and unsubscribe. Cookie policy is unchanged — marketing email is not cookie-based tracking.
