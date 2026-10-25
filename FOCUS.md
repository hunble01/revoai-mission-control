# FOCUS.md (Scope Lock)

## Current Objective
Ship Mission Control in strict checkpoint loops with production-grade UX and reliable data flows.

## Active Ticket
Leads import flow hardening:
- CSV mapping reliability
- validation + dedupe integrity
- DB write safety
- import status/error UX polish

## Allowed Scope (current ticket)
- `apps/**` paths directly related to leads import flow
- `db/**` only if required for import integrity
- supporting docs for this ticket (`docs/**`, this file, execution contract)

## Out of Scope (until shipped/blocked)
- Campaign module expansion
- Marketplace automations
- unrelated refactors
- non-Mission-Control tasks

## Done Definition (for this ticket)
- Import flow handles valid/invalid CSV cases predictably
- Dedupe behavior tested on repeated rows
- Clear user-facing error/success state in UI
- Commit created
- Screenshot captured
- SHIPPED message posted in required format

## Next Ticket (queued, do not start)
TBD by Boss after current ticket shipped.

---
Owner: Jarvis
Updated: 2026-03-04 (UTC)
