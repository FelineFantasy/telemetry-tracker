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

Product update emails celebrate a **finished** minor line — not the first tag of the next milestone.

| Event | Send? | About |
|-------|-------|--------|
| **Line close** — last intended release of `vX.Y.*` before opening the next milestone | **Yes** | Whole **`vX.Y.*`** CHANGELOG (since last emailed / previous minor final) |
| Opening a new line (`vX.Y.0` / major bump) | **No** | Do not announce “what’s new in X.Y” when the line just began |
| Mid-line **PATCH** / hotfix (Z only) | **No** | Dependabot, hotfixes, docs patches stay quiet |
| Exceptional single-version PATCH | **Override** | `--force` (single section only; not full line) |
| Pre-release / draft | **No** | Use `--dry-run` and `--version=Unreleased` to preview copy only |

Examples:

- Closing out **`v1.15.x`** at `v1.15.4` with `previous_version=1.14.4` → **send** about **1.15** (all `1.15.0`…`1.15.4` notes).
- Tagging **`v1.16.0`** to open the next milestone → **skip** (tag push does not email).
- Mid-line **`v1.15.3`** Dependabot → **skip**.

Align semver bumps with [RELEASE.md](./RELEASE.md#semver-guidance). If a closed line has no subscriber-relevant bullets (migrations-only, internal ops), do not run the workflow with `line_close`.

Delivery is recorded in `MarketingReleaseEmailSend` (one row per subscriber per **ledger version**). For line-close sends the ledger key is the minor label **`X.Y`** (e.g. `1.15`), not the closing patch tag. Workflow re-runs and manual retries skip already-sent recipients, deliver to subscribers who joined after the first broadcast, and do not rotate unsubscribe tokens again for completed sends. GitHub Actions logs and a note in the GitHub Release are the operator-facing records.

Reserved / documentation domains (`example.com`, `example.org`, `example.net`, and similar RFC special-use hosts) are rejected on subscribe and skipped at send time — Resend returns 422 for those addresses and would otherwise leave the broadcast incomplete.

### Line-close send (preferred)

When the milestone is done and you cut (or have cut) the **last** intended tag of `vX.Y.*`, send via **Actions → Release product email → Run workflow**:

| Input | Value |
|-------|--------|
| `version` | Closing tag (`X.Y.Z`) — last release of the line |
| `previous_version` | Last emailed release / **previous minor final** (must be outside the closing `X.Y` line — not another `X.Y.*` patch) |
| `line_close` | **true** (default on workflow_dispatch) |

That runs `send-release-email.ts --version=… --previous-version=… --line-close`, which:

1. Allows the send even when `version` is a Z-only bump vs `previous_version`.
2. Composes the email body from **all** `CHANGELOG.md` sections for that **`X.Y.*`** line after `previous_version` through `version`.
3. Uses subject / badge **`Telemetry Tracker X.Y is out`** and ledger key **`X.Y`**.

Tag pushes still start the workflow but **never auto-send** under this policy (opens and mid-line patches both skip). Use dispatch with `line_close` when you are ready to email.

Apply production migrations **before tagging** ([RELEASE.md](./RELEASE.md#3-database-migrations-production)); this workflow does not run `prisma migrate deploy` (GitHub Actions cannot reach Railway private `*.railway.internal` URLs).

Required GitHub secrets in the **`production`** environment:

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | Production Postgres **public** URL (Railway TCP proxy / public host — not `postgres.railway.internal`) |
| `RESEND_API_KEY` | Resend API |
| `TELEMETRY_EMAIL_FROM` | From address on a **verified** Resend domain — use `Telemetry Tracker <noreply@tacko.io>`, not `@telemetry-tracker.com` (see [BILLING.md → Production setup](./BILLING.md#production-setup-hosted-cloud)) |
| `TELEMETRY_DASHBOARD_ORIGIN` | Unsubscribe / docs links (e.g. `https://telemetry-tracker.com`) — app URL only; does not set the mail-from domain |

Store these in the GitHub **`production`** environment. Finalize `CHANGELOG.md` on `main` **before** the closing tag so the composed line body matches what shipped.

### Manual send (CLI / backfill)

```bash
cd apps/api
# Preferred — close out a minor line:
pnpm exec tsx scripts/send-release-email.ts --dry-run \
  --version=1.15.4 --previous-version=1.14.4 --line-close
pnpm exec tsx scripts/send-release-email.ts \
  --version=1.15.4 --previous-version=1.14.4 --line-close

# Exceptional single-version PATCH (not full line):
pnpm exec tsx scripts/send-release-email.ts --version=X.Y.Z --previous-version=X.Y.Z-1 --force
```

Spot-check one inbox (rendering + unsubscribe link) after manual sends. Note in the GitHub Release: “Product update email sent to N subscribers on YYYY-MM-DD.”

### v1.4.2 backfill (one-time)

v1.4.2 shipped the subscriber list and release script but **no automated send ran** — subscribers have not received a product update email yet. Send once when ready (single-version backfill with `--force`, or `--line-close` if composing the whole `1.4.*` line):

```bash
cd apps/api
pnpm exec tsx scripts/send-release-email.ts --dry-run --version=1.4.2 --force
pnpm exec tsx scripts/send-release-email.ts --version=1.4.2 --force
```

Skip separate emails for v1.4.0 / v1.4.1 unless you deliberately want historical catch-up; start the cadence from v1.4.2.

## Sending a release email (MVP)

Requires Resend (`RESEND_API_KEY`, `TELEMETRY_EMAIL_FROM`) and `TELEMETRY_DASHBOARD_ORIGIN` for unsubscribe links.

```bash
cd apps/api
pnpm exec tsx scripts/send-release-email.ts --help
pnpm exec tsx scripts/send-release-email.ts --dry-run \
  --version=1.15.4 --previous-version=1.14.4 --line-close
pnpm exec tsx scripts/send-release-email.ts \
  --version=1.15.4 --previous-version=1.14.4 --line-close
```

- `--version=X.Y.Z` is the closing release tag (CHANGELOG anchor). Required for a live send; omit only with `--dry-run` to preview `[Unreleased]`.
- `--previous-version=X.Y.Z` is the last emailed / previous minor final. Without `--line-close` or `--force`, opening a new line and mid-line patches are skipped.
- `--line-close` sends for the whole minor line (`X.Y.*` since `--previous-version`); ledger + subject use `X.Y`.
- `--force` sends a single-version section even when the bump check would skip (not full line; mutually exclusive with `--line-close`).
- `--dry-run` prints subject, recipient count, and a short CHANGELOG preview without sending.
- Before each successful send, the script rotates the one-click unsubscribe token for that recipient: the hash is written **before** Resend sends so the link in the message always matches the database; failed sends restore the prior token.
- After a successful Resend delivery, a `MarketingReleaseEmailSend` row is written so retries send only to remaining subscribers (requires migration `20260708140000_marketing_release_email_send`).
- If there are **no active subscribers**, the script exits non-zero; re-run the workflow after subscribers exist.

### First production send checklist

1. Merge migration `20260703140000_marketing_subscriber` and deploy API.
2. Confirm Resend domain and `TELEMETRY_EMAIL_FROM` (see [BILLING.md](./BILLING.md)).
3. Set `TELEMETRY_DASHBOARD_ORIGIN=https://telemetry-tracker.com` on the API.
4. Finalize the target version section in `CHANGELOG.md` on `main`.
5. Run `--dry-run --version=X.Y.Z --previous-version=… --line-close`, verify subscriber count and subject (`X.Y is out`).
6. Run with `--version=X.Y.Z --previous-version=… --line-close` (no `--dry-run`) from a secure operator machine with production `DATABASE_URL`, or use workflow_dispatch.
7. Spot-check inbox rendering and the unsubscribe link.

### Automation

Tag pushes start [Release product email](../.github/workflows/release-email.yml) but **do not send** by default (opening a new line and mid-line patches both skip). Send on **line close** via workflow_dispatch with `line_close=true`. See [When to send](#when-to-send-maintainer-policy).

## Privacy

Hosted cloud privacy policy covers product update emails, consent, and unsubscribe. Cookie policy is unchanged — marketing email is not cookie-based tracking.
