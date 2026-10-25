# Execution Contract (Boss ↔ Jarvis)

Purpose: enforce delivery discipline for Mission Control.

## 1) Single Active Ticket
- Only one active ticket at a time.
- No side tasks until current ticket is shipped or blocked.

## 2) Proof-Only Updates
Allowed status formats only:

- `SHIPPED: <feature> | <commit> | <screenshot path>`
- `BLOCKED: <exact blocker> | <what I need>`

Any other progress phrasing is disallowed.

## 3) Checkpoint SLA
- If no shipped checkpoint within 4 hours, send a BLOCKED update automatically.
- No "still working" updates.

## 4) Commit Discipline
- Every completed slice ends with a commit.
- No long-running uncommitted work.

## 5) Scope Lock
- `FOCUS.md` is the source of truth for current objective and allowed scope.
- Work outside `FOCUS.md` scope counts as drift and must be reported as BLOCKED.

## 6) Daily Output Floor
- Minimum target: 2 shipped checkpoints per day.
- If missed, report cause + recovery plan in one BLOCKED-formatted message.

## 7) Blocker Escalation Rule
- Escalate immediately when blocked by access, environment, ambiguity, or external dependency.
- Include exact unblock request.

## 8) Done Definition
A slice is only done when all are present:
1. Implemented feature in code
2. Commit hash
3. Screenshot evidence
4. Short SHIPPED line in required format

## 9) Effective Scope
- Project: `revoai-mission-control`
- Priority: Mission Control build completion

---
Last updated: 2026-03-04 (UTC)
