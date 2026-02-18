# RevoAI Mission Control — MVP PRD (Phase 2)

## 1) Product Summary
RevoAI Mission Control is a real-time command center for agent-driven growth ops with strict approvals, full visibility, and replayable audit trails.

**Phase 2 scope:** planning/build + internal workflow automation only. No external send/post execution.

## 2) Goals
1. Real-time visibility into every meaningful agent action.
2. Approval-gated workflow for all outbound drafts/assets.
3. Audit-first traceability (append-only event log + replay).
4. Scheduler-driven daily pipeline in Toronto time.
5. Dry-run-safe automation (generate, score, draft, approve flows without external publishing).

## 3) Non-Goals (MVP)
- No actual outbound delivery/publishing to channels.
- No Google OAuth.
- No cryptographic hash-chain audit yet (append-only DB log only).

## 4) Roles
### Active now
- **Admin (Michael)**

### Role-ready (future)
- Operator/VA
- Closer/Sales
- Viewer

## 5) Core Workflow
Campaign config → Scheduler job runs → Leads created/enriched/scored → Drafts created + QA → Approval Inbox → Admin decisions (approve/reject/request changes/edit inline/approve with notes) → Done (no send in MVP).

## 6) Core Feature Set (MVP)

### A) Task Board (Kanban)
Columns: **Backlog → Doing → Needs Approval → Done**
- Agents/operators can move to Doing / Needs Approval.
- Only Admin can mark Done.

### B) Agent Cards
For each agent: status, current task, last update, pause/resume.

MVP agents:
- Orchestrator
- Lead Finder
- Enrichment Agent
- Copywriter
- Content Agent
- QA/Compliance Agent

### C) Live Activity Feed (Realtime)
Required event classes:
1. task created/updated
2. agent started task
3. progress milestone
4. draft created/updated/versioned
5. draft submitted to approval
6. approval decision (+ approved_with_notes)
7. lead added/enriched/scored/overridden
8. error/blocked/retry/pause/kill
9. scheduler started/completed/failed
10. campaign activated/updated

### D) Approval Inbox (control center)
Actions:
- Approve
- Reject
- Request changes
- Edit inline + approve
- Approve with notes (**marks approved immediately**)

Approval notes must be visible in draft history.

### E) Audit Log + Replay
- Append-only audit table for all state-changing actions.
- Replay timeline per task.

### F) Leads View
Required fields:
- business name
- niche
- region
- website
- contact name/role
- email/phone (public)
- source
- lead score (A/B/C)
- lead score override + reason
- status
- last action + next step
- personalization bullets
- linked campaign

Includes search/filter + CSV export.

### G) Drafts View
Required fields:
- channel
- linked lead/company + campaign
- draft type
- versions
- status (draft/needs_approval/approved/rejected)
- approver
- comments/edits
- scheduled send time field (future)

### H) Campaigns Module (new MVP requirement)
Campaign ties together:
- niche
- geography
- lead rules (incl. score threshold)
- outreach templates
- content themes
- metrics

**Leads and drafts must link to a campaign.**

### I) Scheduler Module (new MVP requirement)
Timezone: **America/Toronto**
Configurable jobs:
- 09:00 Lead Research
- 09:30 Enrichment + scoring
- 10:30 Outreach Drafting + QA → Approval Inbox
- 12:00 Content Research + Creation + QA → Approval Inbox
- 16:30 Daily Brief (3 wins / 3 blockers / 3 next moves)

### J) Dry-Run + Channel Safety Toggles (new MVP requirement)
- Global `dryRunMode` = **ON by default**
- Per-channel outbound toggles = **OFF by default**:
  - Email
  - Facebook
  - Instagram
  - LinkedIn

No external sends/posts unless explicitly enabled later.

## 7) Scoring Rules (MVP)
- Rule-based A/B/C scoring engine.
- Admin manual override allowed with required reason.
- Signals can include: ads present, weak CTA, missing booking flow, reviews level, after-hours lead-loss likelihood.

## 8) Acceptance Criteria
1. Daily scheduler jobs run in Toronto timezone and emit events.
2. Dry-run mode prevents all outbound execution paths.
3. Channel toggles default OFF and are enforced server-side.
4. All approval actions are logged and visible in history.
5. Approve-with-notes marks approved and records notes/event.
6. Leads + drafts always linked to campaigns.
7. Board/feed/cards update in real-time.
8. Audit replay works for any task.
9. Works locally end-to-end via Docker Compose.
