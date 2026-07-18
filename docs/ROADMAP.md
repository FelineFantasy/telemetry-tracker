# Telemetry Tracker roadmap milestones

Future product lines after the shipped **v1.13.x — Dashboard UX**, **v1.14.x — Notifications**, and **v1.15.x — Alert Rules** lines.

> **Version note:** The thematic roadmap originally drafted Notifications as `v1.13.x`, but that line number was already used for Dashboard UX (`v1.13.0`–`v1.13.2`). Notifications therefore started at **`v1.14.x`**, with later themes shifted by one.

Roadmap **priorities** (P3–P9, etc.) remain independent of release numbering. Parent vision issues stay the source of truth for scope and **should remain open** as living roadmap; child issues close when their implementation merges. Child issues may ship as `v1.N.0`, `v1.N.1`, … within a line.

## Progression

```text
v1.13.x  Dashboard UX          (shipped)
        ↓
v1.14.x  Notifications         (shipped)
        ↓
v1.15.x  Alert Rules           (shipped)
        ↓
v1.16.x  Release Intelligence
        ↓
v1.17.x  Performance Intelligence
        ↓
v1.18.x  AI Intelligence
        ↓
v1.19.x  Organization Management
        ↓
v1.20.x  Data & Export
```

## Milestones

| Milestone | Theme | Issues |
|-----------|--------|--------|
| [v1.13.x — Dashboard UX](https://github.com/Telemetry-Tracker/telemetry-tracker/milestone/12) | Nav/rename/ATF polish | Shipped (#480, #482, #484, #486, …) |
| [v1.14.x — Notifications](https://github.com/Telemetry-Tracker/telemetry-tracker/milestone/17) | Operational awareness | Shipped — parent #492; children #508, #499, #223, #224, #225, #500, … |
| [v1.15.x — Alert Rules](https://github.com/Telemetry-Tracker/telemetry-tracker/milestone/18) | When & where to notify | Shipped — parent #493; children #532–#536 (foundation, UX, conditions + cron, built-ins, release) |
| [v1.16.x — Release Intelligence](https://github.com/Telemetry-Tracker/telemetry-tracker/milestone/19) | Release health + search | #453, #494 |
| [v1.17.x — Performance Intelligence](https://github.com/Telemetry-Tracker/telemetry-tracker/milestone/20) | Compare + performance UX | #495, #197, #196 |
| [v1.18.x — AI Intelligence](https://github.com/Telemetry-Tracker/telemetry-tracker/milestone/21) | Grounded AI summaries | #496 |
| [v1.19.x — Organization Management](https://github.com/Telemetry-Tracker/telemetry-tracker/milestone/22) | Org defaults + PII | #497, #477, #476 |
| [v1.20.x — Data & Export](https://github.com/Telemetry-Tracker/telemetry-tracker/milestone/23) | Export & share | #498 |

## Theme summaries

### v1.14.x — Notifications (shipped)

Know immediately when something important happens. Notification Center, email fan-out, and Delivery channels (webhooks / Slack / Discord / Teams / Telegram).

### v1.15.x — Alert Rules (shipped)

Decide when notifications should be generated and where they should be delivered. See [ALERT-RULES.md](./ALERT-RULES.md). Ops: schedule the [alert-rules-evaluator cron](./RAILWAY.md#alert-rules-evaluator-cron) for non-ingest conditions.

### v1.16.x — Release Intelligence

Understand release health and find telemetry across releases, errors, events, and sessions.

### v1.17.x — Performance Intelligence

Understand whether application health is improving or regressing over time.

### v1.18.x — AI Intelligence

Turn telemetry into actionable insights through AI-generated summaries and recommendations.

### v1.19.x — Organization Management

Manage multiple projects consistently through organization-wide defaults and safe customization.

### v1.20.x — Data & Export

Export telemetry data for reporting, compliance, and external workflows.

## Notes

- Milestones group features that provide value together.
- Parent roadmap issues remain the source of truth for scope and future extensions (prefer leaving them open after the milestone closes).
- Child issues may ship incrementally within their milestone as implementation slices are completed.
- Product update emails send on **minor line close** (whole `vX.Y.*`), not on the first `.0` of the next milestone — see [MARKETING-EMAIL.md](./MARKETING-EMAIL.md).
