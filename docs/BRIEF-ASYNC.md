# Workspace brief async generation (Phase Async-A)

Async-A replaces the synchronous AI read path with Postgres-backed durable storage and a background worker. There is **no** `BRIEF_ASYNC_READ_ENABLED` flag — the async path is the only implementation once this phase lands.

## Architecture

```text
Dashboard POST /meta/brief/workspace
  → user auth (membership)
  → organization-scoped snapshot + hashes
  → BriefCompleted(current)?  → meta.source = "ai"
  → BriefCompleted(stale)?    → meta.source = "stale"
  → enqueue BriefGenerationJob (idempotent)
  → factual fallback (unavailable)

Brief worker (organization-scoped)
  → claim job
  → rebuild snapshot (live telemetry)
  → verify hashes
  → POST private stub
  → persist BriefCompleted
  → complete job
```

## Invariants

### Organization-scoped worker

The worker never depends on `userId`, session state, viewer permissions, or dashboard state. Its inputs are:

- `organizationId`
- `contentHash`
- `presentationHash`
- `responseSchemaVersion`
- `requestId` (immutable, set at enqueue)

The API authorizes the user, then builds the **same organization-scoped snapshot** used by the worker (all organization projects, no per-user acknowledgement windows).

### No additional cache layers

Async-A uses Postgres only:

- `BriefCompleted`
- `BriefGenerationJob`

No L1 memory cache, Redis, or semantic cache on the read path. Profiling may justify an L1 layer later.

### Immutable `requestId`

`requestId` is allocated once per generation at job enqueue and stored on `BriefCompleted`. Dashboard polls reuse it until a new hash produces a new generation.

### Worker rebuilds snapshots

Jobs do not store `snapshot_json`. On claim, the worker rebuilds from current telemetry and expires the job when hashes no longer match.

## Storage

| Model | Purpose |
|-------|---------|
| `BriefCompleted` | Durable AI brief payloads |
| `BriefGenerationJob` | Postgres queue with lease-based claiming |

**Idempotency key:** `organizationId + contentHash + presentationHash + responseSchemaVersion`

## Retention

| Policy | Env | Default |
|--------|-----|---------|
| DB retention | `BRIEF_COMPLETED_RETENTION_DAYS` | 30 days |
| Stale display | `BRIEF_STALE_MAX_DISPLAY_DAYS` | 7 days |

Prune cron is deferred to Async-B. Reads enforce the stale display cutoff in Async-A.

## Contract changes (Async-A)

Additive only:

- `meta.source: "stale"` alongside `"ai"` and `"cache"`

No `generationStatus`, `refreshAfterMs`, or timeout changes on the public route.

## Worker

```bash
pnpm --filter api brief-worker          # poll loop
pnpm --filter api brief-worker -- --once  # single job
```

| Env | Default |
|-----|---------|
| `TELEMETRY_AI_BRIEF_WORKER_TOTAL_BUDGET_MS` | 60000 |
| `TELEMETRY_AI_BRIEF_WORKER_ATTEMPT_TIMEOUT_MS` | 60000 |
| `TELEMETRY_AI_BRIEF_WORKER_LEASE_MS` | 60000 |
| `BRIEF_WORKER_POLL_MS` | 1000 |

## Rollback

- `BRIEF_GENERATOR_MODE=stub` in the private service
- Disable the worker process
- Factual fallback on hash miss
- Serve stale `BriefCompleted` rows within the 7-day window

## Known gap (Async-C)

`POST /meta/brief/ack` still reads in-memory served-meta. DB-served `ai` / `stale` briefs return **409 stale_brief** until Async-C adds durable served-meta persistence.

## Client polling (MVP)

Dashboard polls every **15 seconds** while showing fallback or stale briefs. No server-side polling hints in Async-A.

## Private service

`telemetry-tracker-ai` is unchanged in Async-A. The worker calls the existing stub endpoint with `BRIEF_GENERATOR_MODE=stub` and `BRIEF_LLM_ROLLOUT_PERCENT=0`.
