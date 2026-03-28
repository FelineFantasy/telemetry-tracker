# Organizations, projects, API keys, and usage limits

This document describes the **architecture** (orgs, projects, keys, metering) and how it fits **future dashboard auth**. Numbers for tiers and caps are **product assumptions**, not fixed truth — iterate after you have real usage (sessions vs events cost, retention, which limits actually bind).

---

## Architecture vs provisional numbers

| Keep stable | Treat as temporary |
|-------------|-------------------|
| Scoping telemetry to **projects**; ingest credentials **per project** | Tier **names** (`FREE` / `PRO` / …) |
| **Organization** as billing owner; **soft-delete** for audit/history | **Unit caps**, RPS, max projects, max keys |
| **API keys** as labeled, revocable objects with lifecycle fields | **“Apps per project”** as a limit dimension (may be wrong abstraction — see below) |
| **Monthly usage meters** (until you pivot to retention-weighted pricing) | Exact **ingest unit** definition (you might split events vs errors vs sessions) |

Do not let early billing sketches constrain the product: the schema is meant to stay useful if you later emphasize **retention**, **error volume**, or **seat-based** billing instead of raw units.

---

## Data model (tables)

| Table | Purpose |
|--------|---------|
| **Organization** | Billing owner. `plan_tier`, optional Stripe ids, **`deleted_at`** (soft-delete). |
| **Project** | Telemetry namespace; **`deleted_at`** (soft-delete). `slug` unique per org. |
| **ApiKey** | Ingest credential **and** manageable object — see [API key lifecycle](#api-key-lifecycle-and-states) below. |
| **UsageMonthly** | Per-project, UTC month: `year_month`, `ingest_units`. |
| **Event**, **Session**, **ErrorGroup**, **ErrorOccurrence** | All scoped with `project_id`. |

**Ingest unit (current implementation):** one per accepted `POST /event`, each `POST /batch` item, `POST /session`, `POST /error`. You may later split or weight types without changing the org/project/key shape.

> Ingest units are a **billing abstraction** and may not directly reflect infrastructure cost, which can depend on **payload size**, **retention**, and **query patterns**.

**“App” in payloads:** today `app` is a logical label inside event/session/error payloads (e.g. web, server, iOS). It may evolve into a first-class entity or disappear as a billing dimension — the provisional “max apps per project” in `plans.ts` should not be treated as a permanent product constraint.

---

## API key lifecycle and states

Keys are **user-visible objects**: product direction is to manage them in the UI (create, label, rotate, revoke) rather than treating them as opaque strings.

Each key is a row you can show in a UI, not only a secret string.

| Field | Role |
|--------|------|
| `name` | Optional label (e.g. “Production”, “CI”). |
| `public_id` + `secret_hash` | Lookup and verification (`tt_live_<publicId>_<secret>`). |
| `created_at` | When the key was issued. |
| `last_used_at` | Updated on successful ingest auth (best-effort) so you can show “still in use”. |
| `revoked_at` | Explicit invalidation (rotation, security). Ingest **rejects** if set. |
| `expires_at` | Optional; if set and in the past, ingest **rejects**. Null means no expiry. |
| `deleted_at` | Soft-delete: hidden from normal UI, ingest **rejects**; keeps history. |

**Derived states (for UI):**

| State | Typical condition |
|--------|-------------------|
| Active | `deleted_at` and `revoked_at` null, and (`expires_at` null or future), project and org not soft-deleted |
| Revoked | `revoked_at` set |
| Expired | `expires_at` ≤ now |
| Deleted (archived) | `deleted_at` set |

**Ingest validation order (conceptually):** resolve row by `public_id` → reject if revoked, deleted, expired, or parent project/org soft-deleted → verify secret → accept.

---

## Soft delete (organizations, projects, API keys)

Prefer **`deleted_at`** over hard `DELETE` for anything tied to **telemetry history, audit, or billing**.

- **Organization:** set `deleted_at` when the org is closed; keep rows for reconciliation and support.
- **Project:** set `deleted_at` when a project is removed; events/errors remain attributable to historical IDs if needed.
- **ApiKey:** use **`revoked_at`** for “this secret must stop working now”; use **`deleted_at`** to archive the key record while keeping metadata.

Application code should treat `deleted_at IS NULL` as “active” for listings and for allowing ingest (together with key validity checks above).

---

## API key format and HTTP headers

**Key shape:** `tt_live_<publicId>_<secret>`

The `tt_live_` prefix marks **production** credentials. Later you might add other prefixes (e.g. `tt_test_` for sandbox-only keys) without changing the `public_id` / secret layout — not implemented yet, but the naming leaves room for it.

- `publicId`: 32 lowercase hex characters.
- `secret`: hex string (no underscores); server stores only `hash(publicId + ":" + secret)` (SHA-256 hex).

| Header | Value |
|--------|--------|
| `Authorization` | `Bearer tt_live_<publicId>_<secret>` |
| `X-API-Key` | `tt_live_<publicId>_<secret>` |

**Development:** `INGEST_ALLOW_UNAUTHENTICATED=true` + `TELEMETRY_PROJECT_ID` — not for production.

---

## Dashboard auth (next): users and memberships

This repo’s ingest model is **org → project → API key**. **Human login** layers on naturally without changing that core:

| Concept | Role |
|---------|------|
| **User** | Identity (email/OAuth subject) — not the same as an API key. |
| **OrganizationMembership** | `(user_id, organization_id)` with a **role**. |
| **Roles** (evolve over time) | e.g. `owner`, `admin`, `member` — start with one role if needed. |

You do not need every role on day one; defining the shape early avoids awkward migrations when the dashboard ships. Memberships authorize **management** (create projects, rotate keys, view billing); **ingest** stays authenticated by **project API keys** (or future separate tokens).

---

## Retention (future)

Retention may be enforced **per plan** (e.g. FREE: 14 days, PRO: 90 days). It can become a **primary cost control** and may **replace or complement** ingest-unit limits once you understand real query and storage patterns.

---

## Example plan limits (code defaults only)

Source: `PLAN_LIMITS` in `apps/api/src/config/plans.ts`. **Replace these after a few weeks of metrics** — they are placeholders.

| Tier | Monthly ingest units | Max ingest RPS | Max apps / project | Max projects / org | Max API keys / project |
|------|----------------------|----------------|---------------------|----------------------|-------------------------|
| FREE | 250,000 | 20 | 5 | 1 | 2 |
| PRO | 5,000,000 | 100 | 50 | 10 | 10 |
| BUSINESS | 50,000,000 | 500 | 500 | 50 | 50 |

---

## How to set the free tier so you do not lose money

There is no universal number; derive a bound from **your** infra and usage.

### 1. Variable cost per ingest unit

Estimate incremental monthly cost per unit (or per 1M units): DB writes/storage, egress, compute. Use **bills ÷ units** once you have traffic.

### 2. Fixed monthly cost

Fixed \(F\): base DB, minimum replicas, domains, tooling.

### 3. Free-tier subsidy budget

Let \(S\) = max monthly spend you accept on free users. With \(N_f\) free projects and \(U_f\) units per project per month:

\[
\text{cost}_\text{free} \approx N_f \times U_f \times c_u + F_f
\]

Keep \(\text{cost}_\text{free} \leq S\). Solve for caps conservatively; revisit when **retention** or **event mix** matters more than raw counts.

### 4. Iterate

Log usage by project, margin, and which limits actually hit. Adjust **provisional** caps in `plans.ts` — not the org/project/key architecture.
