# Organization roles (dashboard)

Roles are stored per user per organization (`OrganizationMembership.role`). Enum values: **`OWNER`**, **`EDITOR`**, **`VIEWER`**.

Ingest remains authenticated with **project API keys**, not user sessions.

## Permission matrix

| Capability | VIEWER | EDITOR | OWNER |
|------------|--------|--------|-------|
| Read telemetry (dashboard GETs scoped to project) | Yes | Yes | Yes |
| Resolve / unresolve error groups (`PATCH /api/errors/:id`) | No | Yes | Yes |
| List API keys (`GET /api/project/api-keys`) | Yes | Yes | Yes |
| Create API key (`POST /api/project/api-keys`), optional `allowedApp` for per-app restriction | No | Yes | Yes |
| Revoke API key (`POST /api/project/api-keys/:publicId/revoke`) | No | No | Yes |
| List organizations (`GET /api/meta/organizations`) | Yes | Yes | Yes |
| Create organization (`POST /api/meta/organizations`; you become owner of the new org) | Yes | Yes | Yes |
| Create project (`POST /api/meta/projects`) | No | No | Yes |
| Add member / email invite (`POST /api/meta/organizations/:orgId/members`) | No | No | Yes |
| Change member role (`PATCH /api/meta/organizations/:orgId/members/:userId`) | No | No | Yes |

**Per-app API keys:** If `ApiKey.allowed_app` is set, ingest requests authenticated with that key must send the same value in the JSON `app` field on `/ingest/event`, `/ingest/session`, `/ingest/batch`, and `/ingest/error`. Mismatch returns **403**.

**Invites:** Unknown emails create an `OrganizationInvite` row; owners receive an invite URL (e.g. `/register?invite=…`). `POST /api/auth/register` with `inviteToken` creates the user with a single **OrganizationMembership** on that organization at the invite role.

**Registration (self-serve, no invite):** The new user is created **without** any `OrganizationMembership`. They use `POST /api/meta/organizations` to create a workspace (they become **`OWNER`** of that org), then add projects and API keys as usual. **`TELEMETRY_ALLOW_REGISTRATION`** controls whether signups are allowed after the first user row exists; the first user row can still be created this way when the database is empty.

**API enforcement:** **Mutations** (`POST`/`PATCH` that change data or API keys, including `PATCH /api/errors/:id`, `POST /api/project/api-keys`, revoke) **require** a valid session (`Authorization: Bearer` or session cookie) and then enforce role. Unauthenticated callers receive **401**. **GET** telemetry routes require a session in **production** (`NODE_ENV=production`); in development, or when `TELEMETRY_ALLOW_UNAUTHENTICATED_READS=true`, legacy unauthenticated project scoping remains available for local tooling (see `resolveReadProjectId` in `apps/api/src/lib/read-project-request.ts`).

**Dashboard:** `/api/meta/session-context` returns `role`, boolean capability flags, `usageQuota`, and `billingHealth` (Stripe subscription snapshot for billing banners when configured) for the active project and sidebar organization (`X-Project-Id` / `X-Organization-Id` + session).

**Organization scoping:** The dashboard may send `X-Organization-Id` so `GET /api/meta/projects` returns only projects in that organization (caller must be a member).
