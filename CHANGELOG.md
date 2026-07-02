# Changelog

All notable changes to the **Telemetry Tracker platform** (API + dashboard) are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
App releases use semver tags on `main` (`v1.0.0`, `v1.1.0`, …). SDK packages (`@tacko/telemetry-*`) version independently on npm.

Contributors: add user-facing changes under **[Unreleased]** in your PR to `develop`. Maintainers finalize the version section when promoting a milestone to `main`. See [docs/RELEASE.md](docs/RELEASE.md).

---

## [Unreleased]

### Added

- **Source maps (phase 1)** — persist `release` on error ingest and show release on error detail (foundation for v1.3.0 symbolication)
- **Source maps (phase 2)** — `SourceMapArtifact` storage model, lookup helpers, and retention sweep integration
- **Source maps (phase 3)** — `POST/GET /api/project/source-maps` for JSON source map upload and listing (EDITOR+ upload, metadata-only list)
- **Source maps (phase 4)** — server-side stack symbolication on `GET /api/errors/:id` (`symbolicated_stack` / `symbolicated_top_stack`)
- **Source maps (phase 5)** — error detail raw/symbolicated stack toggle and Settings → Source maps listing page
- **Source maps (phase 6)** — per-plan source map artifact quotas and README/docs completion for v1.3.0

### Changed

- **`maintainer-review` on `develop`** — same gate as `main`: 0 human approvals; check auto-passes for @unjica PRs, requires maintainer approval for others

### Database

- `20260703120000_error_release` — `release` column on `ErrorGroup` and `ErrorOccurrence`
- `20260703130000_source_map_artifacts` — source map storage keyed by project, app, release, and bundle URL

---

## [1.2.1] - 2026-06-28

### Changed

- **Official hosted cloud URL** — documentation and env examples now use [telemetry-tracker.com](https://telemetry-tracker.com) as the canonical dashboard domain (legacy `telemetry-tracker.tacko.io` redirects)

---

## [1.2.0] - 2026-07-01

### Added

- **Alerting v1** — per-project error spike and quota threshold rules, alert history, in-app bell + email delivery, and `/dashboard/alerts` settings UI
- **Bugbot review rules** — `.cursor/BUGBOT.md` (repo, API, dashboard, SDK) plus contributor docs for local `/review-bugbot` and GitHub integration

### Database

After upgrading from v1.1.0, run:

```bash
pnpm --filter api exec prisma migrate deploy
```

New migrations in this release:

- `20260702120000_project_alerts`
- `20260702130000_alert_event_href`

### SDK compatibility

- Platform v1.2.x works with `@tacko/telemetry-*` **>= 1.2.0** (no npm publish required for this release)

---

## [1.1.0] - 2026-07-01

### Added

- **Notifications v1** — in-app bell with read state, notification preferences, transactional email for billing/quota/team/error alerts, and email dedupe
- **Light theme** — dark (default), light, and system appearance; Appearance settings page
- **Flexible time ranges** — Sentry-style date picker and custom ranges across overview and list views
- **Dashboard load performance** — bootstrap API, streaming layout shell, and faster workspace resolution
- **Nav scope pickers** — rich project and app switchers with pinned/recent/search and health dots
- Overview performance indexes and chart/query scope fixes for time ranges

### Changed

- Overview metrics, charts, and list filters align on selected time range and `until` bounds
- Team invite and billing notification ids scoped for correct read state and email dedupe across orgs and re-invites

### Fixed

- Mark-all-read respects quiet-hours-hidden items and sidebar org/project scope
- Invite emails send on re-invite with rotated tokens; error-group emails send only after occurrence persistence
- Theme hydration on Appearance page; chart SSR colors match default dark theme

### Database

After upgrading from v1.0.0, run:

```bash
pnpm --filter api exec prisma migrate deploy
```

New migrations in this release:

- `20260628120000_overview_perf_indexes`
- `20260701120000_user_notification_preferences`
- `20260701130000_notification_read_and_email_log`
- `20260701140000_organization_invite_email_sent_at`
- `20260701150000_organization_invite_email_sent_token`

### SDK compatibility

- Platform v1.1.x works with `@tacko/telemetry-*` **>= 1.2.0** (no npm publish required for this release unless SDK APIs changed)

---

## [1.0.0] - 2026-06-26

First production-ready self-hosted release. See [docs/RELEASE.md#v100-2026-06-26](docs/RELEASE.md#v100-2026-06-26) for full notes.
