# Ingest PII scrubbing

Telemetry Tracker redacts common PII and secrets on the **API ingest write path** before data is stored. This is the source of truth for hosted cloud and self-hosted deployments. Optional SDK-side scrubbing (future) may complement it but never replaces it.

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

Session identity fields (`user_id`, `user_email`, `session_id`, …) are **not** rewritten by Phase 1 scrubbing.

There is no breadcrumbs ingest yet; when added, it should use the same scrubber.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEMETRY_INGEST_PII_SCRUB` | **enabled when unset** | Self-host override: set `false`, `0`, `off`, or `no` to disable scrubbing and store payloads as sent |
| `TELEMETRY_INGEST_PII_SCRUB_MAX_DEPTH` | `8` | Max nesting depth for JSON scrubbing |
| `TELEMETRY_INGEST_PII_SCRUB_MAX_NODES` | `500` | Max nodes visited per payload |

When depth/node limits are hit, the walker stops recursing and applies a shallow scrub — it does **not** throw or reject the ingest request.

Documented in [`apps/api/.env.example`](../apps/api/.env.example) and [DEPLOYMENT.md](../DEPLOYMENT.md).

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
| Sensitive UUID contexts (`user_id=…`) | `[id:N]` |

Sensitive **keys** are matched case-insensitively (`email`, `Email`, `API_KEY`, `phone`, `password`, `token`, …) and replace the entire value with the matching placeholder.

## Code

| Module | Role |
|--------|------|
| `apps/api/src/lib/pii-scrub.ts` | Shared text + JSON scrubber |
| `apps/api/src/lib/ingest-pii-scrub.ts` | Env config + ingest payload helpers |
| `apps/api/src/routes/ingest.ts` | Applies scrubbing after Zod parse, **before** fingerprint and Prisma writes |
| `apps/api/src/lib/brief-snapshot-sanitize.ts` | Reuses `scrubPiiText` for workspace brief messages |

## Architecture

```text
SDK
 ↓
(optional client scrub — Phase 2)
 ↓
API ingest
 ↓
server-side scrub (default on)
 ↓
database → dashboard
```
