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

Session identity fields (`user_id`, `user_email`, `session_id`, …) are **not** rewritten by default scrubbing.

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

### Project deny-list (Phase 2)

Per-project settings (`Project.pii_scrub_settings`) add **extra property/context field names** to redact (case-insensitive). Values become `[redacted]` unless the key already has a built-in placeholder.

Deny-keys are **additive** — they cannot disable mandatory default pattern/key protections. An empty or missing list behaves exactly like Phase 1 defaults.

- Dashboard: **Alerts → PII scrubbing** (editors/owners; same gate as alert settings)
- API: `GET` / `PATCH /api/project/pii-scrub-settings`
- Ingest loads deny-keys with a **per-project** 60s TTL cache; a successful `PATCH` clears that project’s cache entry immediately
- If loading settings fails, ingest logs a warning and continues with **default scrubbing only** (never stores unsanitized data because of a settings outage)

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
| Server ingest | On | Authoritative redaction before fingerprint + storage; merges project deny-keys |

Running both is safe: placeholders such as `[email]`, `[token]`, and `[redacted]` are stable under a second pass.

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
| `apps/api/src/lib/project-pii-scrub-cache.ts` | Short-TTL deny-key cache for ingest |
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
