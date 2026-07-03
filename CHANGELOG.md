# Changelog

All notable changes to the **Telemetry Tracker platform** (API + dashboard) are documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
App releases use semver tags on `main` (`v1.0.0`, `v1.1.0`, …). SDK packages (`@telemetry-tracker/*`) version independently on npm.

Contributors: add user-facing changes under **[Unreleased]** in your PR to `develop`. Maintainers finalize the version section when promoting a milestone to `main`. See [docs/RELEASE.md](docs/RELEASE.md).

---

## [Unreleased]

---

## [1.3.3] - 2026-07-03

### Changed

- **Logo** — nav and brand components use the new `telemetry-logo.jpg` mark

---

## [1.3.2] - 2026-07-03

### Changed

- **Brand icons** — updated favicon, apple-touch-icon, Android chrome icons, and PWA manifest assets

---

## [1.3.1] - 2026-07-02

### Added

- **Hosted cloud docs** — `/docs/hosted-cloud` getting-started guide for telemetry-tracker.com
- **Open Graph image** — dynamic 1200×630 social preview at `/opengraph-image`

### Changed

- **SDK npm scope** — packages renamed from `@tacko/telemetry-*` to `@telemetry-tracker/core`, `@telemetry-tracker/next`, `@telemetry-tracker/node`, and `@telemetry-tracker/react-native` (v1.3.0 in-repo). Publish under `@telemetry-tracker/*` on npm; deprecate legacy `@tacko/*` names after publish.
- **Marketing & legal** — homepage features/hero mention alerting and source maps; Terms and Privacy tailored for official hosted cloud; alert quick action links to `/dashboard/alerts`

---

## [1.3.0] - 2026-07-02

### Added

- **Source maps v1** — persist `release` on errors; upload JSON source maps via `POST /api/project/source-maps`; server-side stack symbolication on error detail (`symbolicated_stack`); dashboard raw/symbolicated toggle; Settings → Source maps listing; per-plan artifact storage quotas (FREE 25 / PRO 250 / BUSINESS 2 500)

### Changed

- **`maintainer-review` on `develop`** — same gate as `main`: 0 human approvals; check auto-passes for @unjica PRs, requires maintainer approval for others

### Database

After upgrading from v1.2.x, run:

```bash
pnpm --filter api exec prisma migrate deploy
```

New migrations in this release:

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

- Platform v1.2.x works with `@telemetry-tracker/*` **>= 1.2.0** (no npm publish required for this release)

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

- Platform v1.1.x works with `@telemetry-tracker/*` **>= 1.2.0** (no npm publish required for this release unless SDK APIs changed)

---

## [1.0.0] - 2026-06-26

First production-ready self-hosted release. See [docs/RELEASE.md#v100-2026-06-26](docs/RELEASE.md#v100-2026-06-26) for full notes.
