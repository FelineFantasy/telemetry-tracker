# SDK packages (`packages/telemetry-*`) — Bugbot rules

Published as `@telemetry-tracker/*` on npm. Semver is **per-package** in each `package.json`, independent of app releases on `main`.

## Breaking change bar

- Flag any change to public export surface, init options, default batching behavior, or ingest payload shape without a semver **major** bump and CHANGELOG note.
- HTTP contract changes must match `apps/api` ingest routes — SDK and API PRs should be reviewed together when either side changes.

## Runtime safety

- SDKs must not throw synchronously from `init` or track calls in ways that crash host apps.
- Avoid Node-only APIs in `telemetry-core` and browser/RN bundles without conditional exports or separate entry points.
- Do not embed API keys or project secrets in client bundles beyond what the integrator passes at runtime.

## Ignore

- Internal test fixtures and dev-only examples unless they ship in the published `files` array.
