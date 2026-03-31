# Organization roles (dashboard)

Roles are stored per user per organization (`OrganizationMembership.role`). Enum values: **`OWNER`**, **`EDITOR`**, **`VIEWER`**.

Ingest remains authenticated with **project API keys**, not user sessions.

## Permission matrix

| Capability | VIEWER | EDITOR | OWNER |
|------------|--------|--------|-------|
| Read telemetry (dashboard GETs scoped to project) | Yes | Yes | Yes |
| Resolve / unresolve error groups (`PATCH /api/errors/:id`) | No | Yes | Yes |
| List API keys (`GET /api/project/api-keys`) | Yes | Yes | Yes |
| Create API key (`POST /api/project/api-keys`) | No | Yes | Yes |
| Revoke API key (`POST /api/project/api-keys/:publicId/revoke`) | No | No | Yes |
| Org settings, invites, project lifecycle (future routes) | No | No | Yes |

**Registration:** The first user in the default organization becomes **`OWNER`**. Additional allowed signups receive **`VIEWER`** unless changed in the database.

**API enforcement:** Mutations check the caller’s role when a **session** is present. Unauthenticated access to the read API retains legacy behavior for local/dev use; production deployments should rely on session-backed dashboard usage.

**Dashboard:** `/api/meta/session-context` returns `role` and boolean flags (`canResolveErrors`, `canCreateApiKey`, `canRevokeApiKey`, `canManageOrganization`) for the active project (`X-Project-Id` + session).
