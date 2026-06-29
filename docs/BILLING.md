# Billing and email (optional)

Stripe billing and Resend email are **optional** for self-hosted installs. Core deployment: [DEPLOYMENT.md](../DEPLOYMENT.md). Plan limits and ingest auth: [ENTITLEMENTS.md](./ENTITLEMENTS.md).

---

## Resend (invites & password reset)

Without email configured, admins must share invite or reset links manually.

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | API key from [Resend](https://resend.com) |
| `TELEMETRY_EMAIL_FROM` | Sender address, e.g. `Telemetry <noreply@yourdomain.com>` |

Both are required for outbound email. Verify your domain in Resend for production.

Optional for the marketing contact form (`POST /api/contact`):

| Variable | Description |
|----------|-------------|
| `CONTACT_INBOX_EMAIL` | Inbox for form submissions (default `info@tacko.io`) |

The contact form uses the same Resend credentials as password reset. Resend will reject sends when:

- `TELEMETRY_EMAIL_FROM` uses `onboarding@resend.dev` but the recipient is not your Resend account email
- the domain in `TELEMETRY_EMAIL_FROM` is not verified in [Resend → Domains](https://resend.com/domains)

Check API logs for `[email] Resend failed:` for the exact rejection reason.

---

## Stripe (paid plans)

Set these on the **API** service to enable checkout, billing portal, and webhooks:

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | `sk_live_…` or test key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` for `POST /webhooks/stripe` |
| `STRIPE_PRICE_PRO` | Stripe Price id for Pro |
| `STRIPE_PRICE_BUSINESS` | Stripe Price id for Business |

### Stripe Dashboard setup

1. **Webhook endpoint:** `https://<your-api>/webhooks/stripe`
2. **Subscribe to events:**
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. **Checkout metadata** on completed sessions: `organization_id` (UUID), `plan_tier` (`PRO` or `BUSINESS`).
4. For subscription-only plan changes, put the same `plan_tier` on **Subscription** or **Price** metadata so `customer.subscription.updated` can sync tier.

Do **not** rely on `invoice.payment_failed` alone for subscription status — use **`customer.subscription.updated`** (Stripe retries while status may still be `active`).

Test with Stripe CLI or Dashboard **Send test webhook** after deploy.

---

## Production checklist

- [ ] Resend domain verified (if using email)
- [ ] Stripe webhook URL reachable from the internet
- [ ] Webhook secret matches `STRIPE_WEBHOOK_SECRET`
- [ ] Test checkout completes and org tier updates

See [PRODUCTION-READINESS.md](./PRODUCTION-READINESS.md) for the full go-live list.
