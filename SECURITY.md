# Security

## Supported versions

Security fixes are applied to the default branch (`main`) and released as usual (tags / deploys as you configure). Older branches may not receive backports unless maintainers agree.

## Reporting a vulnerability

**Please do not file a public GitHub issue** for undisclosed security problems (authentication bypass, remote code execution, data exposure, etc.).

Preferred options:

1. **GitHub private security advisory** for this repository: use **Security → Report a vulnerability** on [github.com/Telemetry-Tracker/telemetry-tracker](https://github.com/Telemetry-Tracker/telemetry-tracker). That opens a private channel with maintainers.
2. If you cannot use advisories, contact the repository maintainers through a **private** channel (e.g. email or DM if published on the maintainer profile) and ask for a secure way to share details.

Include:

- A short description of the issue and its impact
- Steps to reproduce (or a proof-of-concept), if safe to share
- Affected components (API, dashboard, SDK, etc.) and versions/commits if known

We aim to acknowledge receipt in a reasonable time and coordinate disclosure after a fix is available.

## Scope (examples)

In scope: the API server, dashboard app, default deployment configuration documented in this repo, and documented authentication / ingest paths.

Typically out of scope: third-party services (hosting, Stripe dashboard misconfiguration), issues requiring physical access, or spam/low-impact reports without a credible exploit path. When in doubt, report anyway; we can triage.
