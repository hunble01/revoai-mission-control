# Checkpoint / Blocker Message Format

## SHIPPED (required)
`SHIPPED: <feature> | <commit> | <screenshot path>`

Example:
`SHIPPED: Leads CSV import error-state polish | a1b2c3d | revoai-mission-control/docs/shots/leads-import-error-state.png`

## BLOCKED (required)
`BLOCKED: <exact blocker> | <what I need>`

Example:
`BLOCKED: CSV parser fails on BOM-prefixed UTF-8 files in prod build | Need approval to bump parser package and run lockfile update`

## Rules
- Do not send "in progress" updates.
- No ETA-only messages.
- Every SHIPPED requires commit + screenshot.
