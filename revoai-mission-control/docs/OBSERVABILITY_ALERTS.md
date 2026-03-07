# Production Observability Alerts (Workflow-Tied)

Implemented alert surface:
- API endpoint: `GET /api/alerts`
- Overview panel: `Operational Alerts`

Alert checks (operator workflow aligned):
1. `import_failures_24h` — problematic CSV import runs in last 24h
2. `approvals_stall_2h` — drafts in NEEDS_APPROVAL stale >2h
3. `scheduler_failures_24h` — failed scheduler runs in last 24h

Severity rules:
- high / medium / low based on threshold counts

Operator use:
- Check Overview for active warnings
- Open Campaigns import history / Approvals / Scheduler pages to resolve source issue
