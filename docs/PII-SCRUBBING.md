# Ingest PII scrubbing

Telemetry Tracker redacts common PII and secrets on the **API ingest write path** before data is stored. This is the source of truth for hosted cloud and self-hosted deployments. Optional SDK-side scrubbing may complement it but **never replaces** server scrubbing.

Related product issue: [#470](https://github.com/Telemetry-Tracker/telemetry-tracker/issues/470).

## What is scrubbed

On `POST /ingest/error`, `POST /ingest/event`, and `POST /ingest/batch` (batch is **events only** — same `scrubIngestEventFields` helper as `/event`):

| Field | Behavior |
|-------|----------|
| Error `message` | Pattern scrubbing (emails, JWTs, Bearer tokens, API keys, sensitive query/assignment params, cookie/authorization headers) |
| Error `stack` | Same pattern scrubbing; **newlines preserved** (no brief-style whitespace collapse) |
| Error `context` | Recursive JSON walk: sensitive keys → placeholders; other strings pattern-scrubbed |
| Event `properties` | Same recursive JSON walk (`/event` and `/batch`) |

Scrubbing runs **after** Zod parse and **before** `computeFingerprint` / Prisma writes so redacted values are what get stored and grouped.

Session identity fields (`user_id`, `user_email`, `session_id`, …) are **not** rewritten by default scrubbing. Projects may opt in to scrubbing `Session.user_email` (see below).

There is no breadcrumbs ingest yet; when added, it should use the same scrubber.

## Configuration

### Environment (all deployments)

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEMETRY_INGEST_PII_SCRUB` | **enabled when unset** | Self-host override: set `false`, `0`, `off`, or `no` to disable scrubbing and store payloads as sent |
| `TELEMETRY_INGEST_PII_SCRUB_MAX_DEPTH` | `8` | Max nesting depth for JSON scrubbing |
| `TELEMETRY_INGEST_PII_SCRUB_MAX_NODES` | `500` | Soft threshold for switching to the bounded remainder pass (still redacts nested keys/strings) |

When depth/node limits are hit, the walker switches to a key/string remainder pass that still redacts nested PII — it does **not** throw or reject the ingest request. A hard ceiling of 10 000 remainder nodes returns `[truncated]` for further structure to bound CPU.

Documented in [`apps/api/.env.example`](../apps/api/.env.example) and [DEPLOYMENT.md](../DEPLOYMENT.md).

### Project deny-list (Phase 2+)

Per-project settings (`Project.pii_scrub_settings`) add **extra property/context field names** to redact (case-insensitive). Values become `[redacted]` unless the key already has a built-in placeholder.

Deny-keys are **additive** — they cannot disable mandatory default pattern/key protections. An empty or missing list behaves exactly like Phase 1 defaults.

Optional flag `scrubSessionUserEmail` (default **false**): when enabled, ingest stores `Session.user_email` as the stable placeholder **`[email]`** (not `null`) for any non-empty value before persistence. `null` / empty inputs stay as-is. Leave the flag off if you still need session search/filter by real email. Existing projects without this property parse as `false` (behavior unchanged). No new migration is required — the flag lives in the existing nullable `pii_scrub_settings` JSON.

- Dashboard: **Alerts → PII scrubbing** (editors/owners; same gate as alert settings)
- API: `GET` / `PATCH /api/project/pii-scrub-settings` (partial PATCH merges with previous settings)
- Successful `PATCH` writes an organization audit event (`project.pii_scrub.update`) with deny-key **counts** and the session-email flag — **not** deny-key names. Failed validation / auth does not write an audit event. Audit write failures are swallowed (settings update still succeeds), matching other audit calls in this codebase.
- Ingest loads settings with a **per-project** 60s TTL cache; a successful `PATCH` clears that project’s cache entry immediately
- If loading settings fails, ingest logs a warning and continues with **default scrubbing only** (never stores unsanitized event/error data because of a settings outage; session email scrub stays off)

### Phone and payment-card heuristics (Phase 3)

Default text scrubbing also redacts:

| Pattern | Placeholder | Notes |
|---------|-------------|--------|
| Luhn-valid 13–19 digit PANs (optional spaces/dashes) | `[card]` | Digit runs that fail Luhn (and many timestamps) are left unchanged |
| E.164 / plus-prefixed with optional spaces or dashes, and formatted North American phones | `[phone]` | Bare digit runs and dotted numeric groups (e.g. `123.456.7890`) are **not** matched |

Examples:

| Input | Result |
|-------|--------|
| `+386 40 123 456` | `[phone]` |
| `+1-202-555-0183` | `[phone]` |
| `2025550183` | unchanged |
| `1234567890` | unchanged |
| `4242 4242 4242 4242` | `[card]` |
| `4242-4242-4242-4242` | `[card]` |
| `4242424242424241` | unchanged (fails Luhn) |
| `20260716123000` | unchanged |

False positives are possible for Luhn-valid numeric IDs that look like cards. Prefer deny-listed keys for known sensitive fields when heuristics are too aggressive or too weak.

Property keys such as `phone`, `creditCard`, `cardNumber`, `cvv` already map to `[phone]` / `[card]` regardless of value shape.

### SDK client scrub (Phase 2, optional)

`@telemetry-tracker/core` **1.4.0** adds opt-in client scrubbing. Default is **off** when `piiScrub` is omitted or `false`.

```ts
import { init } from "@telemetry-tracker/core";

// Enable default client pattern/key scrubbing before send
init({
  ingestUrl: "https://api.example.com",
  app: "my-app",
  apiKey: "tt_live_…",
  piiScrub: true,
});

// Same defaults, plus extra deny-listed field names (merged with built-ins)
init({
  ingestUrl: "https://api.example.com",
  app: "my-app",
  apiKey: "tt_live_…",
  piiScrub: { denyKeys: ["nationalId", "customer_ref"] },
});

// Explicit empty denyKeys still enables default scrubbing (no extra keys)
init({
  ingestUrl: "https://api.example.com",
  app: "my-app",
  piiScrub: { denyKeys: [] },
});
```

**SDK vs server**

| Layer | Default | What it does |
|-------|---------|----------------|
| SDK `piiScrub` | Off | Scrubs event `properties` and error `message` / `stack` / `context` before the network request; does **not** mutate caller objects; does **not** touch session identity (`user_id`, `user_email`, …) |
| Server ingest | On | Authoritative redaction before fingerprint + storage; merges project deny-keys; optional `scrubSessionUserEmail` |

Running both is safe: placeholders such as `[email]`, `[token]`, `[phone]`, `[card]`, and `[redacted]` are stable under a second pass.

Upgrade: bump `@telemetry-tracker/core` to `^1.4.0` when you want the opt-in client API. Hosted/self-host API gains project deny-keys via the migration `20260716200000_project_pii_scrub_settings` (nullable JSON — existing projects unchanged until configured).

## Placeholders

Stable placeholders keep debugging useful:

| Kind | Placeholder |
|------|-------------|
| Email | `[email]` |
| JWT | `[token]` |
| Bearer token | `[bearer-token]` |
| API key (`tt_live_…`, `sk-…`, `pk-…`) | `[api-key]` |
| Cookie header / `cookie` key | `[cookie]` |
| Authorization header / `authorization` key | `[bearer-token]` |
| Phone (formatted / E.164; `phone` keys) | `[phone]` |
| Payment card (Luhn; `creditCard` / `cvv` keys) | `[card]` |
| Sensitive query/assignment values | `[redacted]` |
| Project deny-list keys | `[redacted]` |
| Sensitive UUID contexts (`user_id=…`) | `[id:N]` |

Sensitive **keys** are matched case-insensitively (`email`, `Email`, `API_KEY`, `phone`, `password`, `token`, …) and replace the entire value with the matching placeholder.

## Code

| Module | Role |
|--------|------|
| `apps/api/src/lib/pii-scrub.ts` | Shared text + JSON scrubber |
| `apps/api/src/lib/ingest-pii-scrub.ts` | Env config + ingest payload helpers |
| `apps/api/src/lib/project-pii-scrub-settings.ts` | Project deny-list parse/validate |
| `apps/api/src/lib/project-pii-scrub-cache.ts` | Short-TTL settings cache for ingest |
| `apps/api/src/jobs/pii-scrub-backfill.ts` | Opt-in historical scrub CLI |
| `apps/api/src/routes/ingest.ts` | Applies scrubbing after Zod parse, **before** fingerprint and Prisma writes |
| `packages/telemetry-core/src/pii-scrub.ts` | Optional client scrubber |
| `apps/api/src/lib/brief-snapshot-sanitize.ts` | Reuses `scrubPiiText` for workspace brief messages |

## Architecture

```text
SDK
 ↓
(optional) client scrub — piiScrub
 ↓
network
 ↓
API ingest
 ↓
(always*) server scrub + project denyKeys
 ↓
database → dashboard
```

\*Unless `TELEMETRY_INGEST_PII_SCRUB=false`.

## Still deferred

- Custom regex controls in project/org settings
- Organization-level PII defaults inherited by projects

## Opt-in historical backfill (Phase 3b)

Already-stored rows are **not** rewritten by ingest scrubbing. Running this job is **completely optional** — telemetry continues to work without it. Use it when you need to redact historical data after enabling scrubbing (or after tightening deny-keys / session-email settings).

**Always scope** with `--project-id` or `--org-id`. Global / unscoped runs are rejected.

```bash
# Prefer dry-run first (no writes; prints scanned / would-modify / skipped)
pnpm --filter api pii-scrub-backfill -- --project-id <uuid> --dry-run

# Apply (events, error occurrences, error group message/top_stack)
pnpm --filter api pii-scrub-backfill -- --project-id <uuid>

# Also rewrite Session.user_email → [email] when scrubSessionUserEmail is enabled
pnpm --filter api pii-scrub-backfill -- \
  --project-id <uuid> \
  --dry-run \
  --include-sessions

# Optionally scrub ErrorGroup.fingerprint (skips on unique conflicts)
pnpm --filter api pii-scrub-backfill -- \
  --project-id <uuid> \
  --scrub-fingerprints
```

| Flag | Meaning |
|------|---------|
| `--project-id` / `--org-id` | **Required** scope (one of) |
| `--dry-run` | Calculate impact; **no rows modified** |
| `--limit` / `--batch-size` | Cap / cursor page size (bounded memory) |
| `--include-sessions` | Consider sessions (still requires project `scrubSessionUserEmail`) |
| `--scrub-fingerprints` | Opt-in fingerprint rewrite; default leaves fingerprints unchanged |
| `--fail-fast` | Abort on first DB error (default: count and continue) |

**Sessions:** both `--include-sessions` **and** project `scrubSessionUserEmail=true` are required. Otherwise session emails are never touched.

**Fingerprints:** left unchanged by default so grouping identity stays stable. With `--scrub-fingerprints`, unique conflicts are skipped (display fields may still update); conflict counts appear in the summary. Re-runs do not keep regenerating already-scrubbed fingerprints.

**Operational notes:** per-row updates in cursor batches (interrupt-safe for already-committed rows); progress on stderr; human summary + JSON on stdout; non-zero exit on fatal errors or counted database failures. Idempotent — already-scrubbed placeholders (`[email]`, `[token]`, `[phone]`, `[card]`, …) are skipped.

Example summary:

```text
Scanned:
- Events: 15000
- Occurrences: 3500
- Groups: 180
- Sessions: 42

Modified:
- Events: 812
- Occurrences: 114
- Groups: 12
- Sessions: 6

Skipped:
- Already scrubbed: 917
- Fingerprint conflicts: 2

Failures:
- Database errors: 0

Completed successfully.
```

Uses the same scrubber + project deny-keys as ingest. Requires `TELEMETRY_INGEST_PII_SCRUB` enabled. After build: `node dist/jobs/run-pii-scrub-backfill.js …`.

**Risks:** rewriting `ErrorGroup.message` / `fingerprint` can affect how future occurrences group; prefer dry-run and small `--limit` samples first.