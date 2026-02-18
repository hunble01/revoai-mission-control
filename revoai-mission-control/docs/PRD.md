# RevoAI Mission Control — MVP PRD (Phase 2)

## 1) Product Summary
RevoAI Mission Control is a real-time command center for managing agent-driven outreach operations with full transparency, strict approval gates, and auditability.

**Phase 2 scope:** planning/build only. No outreach execution (no actual send/post).

## 2) Goals
1. Real-time visibility into agent activity.
2. Approval-gated workflow for all outbound draft assets.
3. Audit-first traceability with replayable timelines.
4. Clean MVP architecture that works locally via Docker and scales later.

## 3) Non-Goals (MVP)
- No live publishing/sending to channels.
- No Google OAuth (single-admin mode first).
- No tamper-evident cryptographic audit chain yet (append-only DB log only).

## 4) Users & Roles
### Active in MVP
- **Admin (Michael)** — full control, approvals, done-state authority.

### Role-ready (future toggles)
- Operator/VA
- Closer/Sales
- Viewer

## 5) Core Workflow
Lead research → enrichment → draft creation/versioning → needs approval → admin decision (approve/reject/request changes/edit inline) → done (planning/build phase only).

## 6) Core Features (MVP)
### A. Task Board (Kanban)
Columns:
- Backlog
- Doing
- Needs Approval
- Done

Rules:
- Agents/operators can move tasks to **Doing** or **Needs Approval**.
- Only Admin can move tasks to **Done**.

### B. Agent Cards
Each agent card shows:
- status (idle/running/paused/blocked)
- current task
- last update timestamp
- quick controls: pause/resume (admin)

MVP agent set:
- Orchestrator
- Lead Finder
- Enrichment Agent
- Copywriter
- Content Agent
- QA/Compliance Agent

### C. Live Activity Feed (Realtime)
Must stream at least:
1) task created/updated
2) agent started task
3) agent progress milestone
4) draft created/updated/versioned
5) draft submitted to approval
6) approval decision
7) lead added/enriched/scored
8) error/blocked/retry + pause/kill

### D. Approval Inbox (control center)
Approval actions:
- Approve
- Reject
- Request changes
- Edit inline + approve
- (optional) Approve with notes

### E. Audit Log (append-only)
- Every significant action writes an immutable audit event row.
- Replay view reconstructs timeline per task.

### F. Leads View
Required fields:
- business_name
- niche
- region
- website
- contact_name + role
- email + phone (public)
- source
- lead_score (A/B/C)
- status (new/enriched/drafted/approved/contacted/replied/booked/lost)
- last_action_at + next_step
- notes/personalization bullets

Includes:
- search/filter
- CSV export

### G. Drafts View
Required fields:
- channel
- linked lead/company
- draft_type
- version history
- status (draft/needs_approval/approved/rejected)
- approver
- comments/edits
- scheduled_send_at (field only for now)

Includes:
- search/filter
- diff/version view

### H. Safety Controls
- Global pause all agents
- Per-agent pause/resume

## 7) Functional Acceptance Criteria
1. Kanban board updates in real-time from events.
2. Drafts cannot transition to approved/sent-like states without admin action.
3. Every UI action produces a visible feed event + audit entry.
4. Replay timeline works for any selected task.
5. Leads and drafts are searchable/filterable.
6. Leads export to CSV works.
7. Runs locally via Docker Compose end-to-end.

## 8) Quality Attributes
- Fast and readable UI (“mission control” style, low clutter).
- Deterministic status transitions.
- Clear separation between event log and mutable records.
- Simple to extend into multi-user + sender integrations later.

## 9) Milestones
1. Schema + service skeleton
2. Realtime event pipeline
3. Core UI pages (Board, Agents, Feed, Inbox, Leads, Drafts, Audit)
4. Seeded data + end-to-end local run
5. Optional VPS deploy guide
