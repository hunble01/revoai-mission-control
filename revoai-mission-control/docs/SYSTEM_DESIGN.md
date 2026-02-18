# RevoAI Mission Control — System Design (MVP)

## 1) Stack + Architecture
- **Frontend:** Next.js (App Router, TypeScript)
- **Backend:** NestJS + Prisma
- **Database:** PostgreSQL
- **Realtime/Event fanout:** Redis + WebSockets
- **Runtime:** Docker Compose (local-first)

## 2) High-Level Components
1. **Web Dashboard**
   - Task board, agent cards, activity feed, approval inbox, leads, drafts, campaigns, scheduler, audit/replay.
2. **API (NestJS)**
   - Domain modules: auth, tasks, agents, leads, drafts, approvals, campaigns, scheduler, settings, audit.
3. **Event Bus Layer**
   - Write domain event to DB + publish to Redis + stream via WS gateway.
4. **Scheduler Runner**
   - Cron-based job coordinator (Toronto timezone) writing events and task records.
5. **Postgres**
   - Source-of-truth + append-only logs.
6. **Redis**
   - Realtime pub/sub.

---

## 3) Core Data Model (Prisma/Postgres)

### enums
- `Role`: ADMIN, OPERATOR, CLOSER, VIEWER
- `AgentStatus`: IDLE, RUNNING, PAUSED, BLOCKED
- `TaskColumn`: BACKLOG, DOING, NEEDS_APPROVAL, DONE
- `LeadScore`: A, B, C
- `LeadStatus`: NEW, ENRICHED, DRAFTED, APPROVED, CONTACTED, REPLIED, BOOKED, LOST
- `DraftStatus`: DRAFT, NEEDS_APPROVAL, APPROVED, REJECTED
- `ApprovalAction`: APPROVE, REJECT, REQUEST_CHANGES, EDIT_INLINE_APPROVE, APPROVE_WITH_NOTES
- `Channel`: EMAIL, FACEBOOK, INSTAGRAM, LINKEDIN

### tables/models
- `users`
- `agents`
- `tasks`
- `task_events` (timeline)
- `audit_log` (append-only)
- `campaigns` (new)
- `campaign_metrics` (optional JSON or child table)
- `leads` (must reference campaign)
- `drafts` (must reference campaign; optional lead link)
- `draft_versions`
- `approvals`
- `scheduler_jobs`
- `scheduler_runs`
- `settings` (dryRun + channel toggles + pause flags)

### new critical fields
- `settings.dry_run_mode` (default true)
- `settings.outbound_email_enabled` (default false)
- `settings.outbound_facebook_enabled` (default false)
- `settings.outbound_instagram_enabled` (default false)
- `settings.outbound_linkedin_enabled` (default false)
- `leads.score_override` (nullable enum)
- `leads.score_override_reason` (nullable text)

---

## 4) Realtime Event Architecture
1. API mutation/scheduler action occurs.
2. Transaction writes domain state + `task_events` + `audit_log`.
3. Publisher emits compact event to Redis channel `mission_control.events`.
4. WS gateway broadcasts to clients subscribed by workspace/user.
5. UI updates board/feed/cards/inbox in near real-time.

### event envelope
```json
{
  "id": "evt_123",
  "type": "approval.approved_with_notes",
  "entityType": "draft",
  "entityId": "draft_uuid",
  "taskId": "task_uuid",
  "campaignId": "campaign_uuid",
  "timestamp": "2026-02-18T...Z",
  "payload": {
    "notes": "approved with personalization tweak"
  }
}
```

### required new event types
- `scheduler.job.started`
- `scheduler.job.completed`
- `scheduler.job.failed`
- `campaign.created|updated|activated`
- `approval.approved_with_notes`
- `lead.score.overridden`
- `safety.dry_run.toggled`
- `safety.channel_toggled`

---

## 5) Scheduler Module (Toronto Time)
Timezone: `America/Toronto`

Default jobs:
- `09:00` lead_research
- `09:30` enrichment_scoring
- `10:30` outreach_drafting_qa (push to approvals)
- `12:00` content_research_creation_qa (push to approvals)
- `16:30` daily_brief (3 wins / 3 blockers / 3 next moves)

Each run writes:
- scheduler run record
- emitted task events
- audit entries

---

## 6) Dry-Run + Outbound Safety Enforcement
Server-side guard middleware:
- If `dryRunMode === true` => block any outbound executor call.
- If specific channel toggle is OFF => block that channel send path.

MVP behavior:
- Jobs still generate leads/drafts/events.
- Approval flow works fully.
- External sending adapters are disabled/no-op.

---

## 7) Permissions / Transition Rules
- Only Admin can:
  - set task DONE
  - all approval decisions
  - global pause + channel toggles + dry-run toggle
  - score overrides (with reason)
- Agents/operators can:
  - move to DOING / NEEDS_APPROVAL
  - create/update drafts
  - emit progress events

---

## 8) API Surface (initial)
- `GET /health`
- `GET/POST/PATCH /tasks`
- `GET/PATCH /agents`
- `GET/POST/PATCH /leads`
- `POST /leads/:id/score-override`
- `GET/POST/PATCH /drafts`
- `POST /drafts/:id/approve`
- `POST /drafts/:id/reject`
- `POST /drafts/:id/request-changes`
- `POST /drafts/:id/edit-inline-approve`
- `POST /drafts/:id/approve-with-notes`
- `GET/POST/PATCH /campaigns`
- `GET/POST/PATCH /scheduler/jobs`
- `POST /scheduler/jobs/:id/run-now`
- `GET /scheduler/runs`
- `GET/PATCH /settings/safety`
- `GET /events/feed`
- `GET /audit`
- `GET /tasks/:id/replay`

---

## 9) Repo Scaffold
```text
revoai-mission-control/
  apps/
    api/
      src/
        modules/
          approvals/
          campaigns/
          scheduler/
          settings/
          events/
          leads/
          drafts/
          tasks/
          agents/
        prisma/
          schema.prisma
    web/
      app/
        board/
        agents/
        feed/
        approvals/
        leads/
        drafts/
        campaigns/
        scheduler/
        audit/
  db/
  seed/
  docs/
  docker-compose.yml
```

---

## 10) Docker Compose Layout
Services:
- `postgres`
- `redis`
- `api` (NestJS)
- `web` (Next.js)

---

## 11) Preloaded Build Tasks (updated)
Include prior backlog + new tasks:
- implement campaigns module
- implement scheduler jobs/runs
- implement dry-run + channel toggles in settings + middleware guards
- implement score override endpoint + UI
