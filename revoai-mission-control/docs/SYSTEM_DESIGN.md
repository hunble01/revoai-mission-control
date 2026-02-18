# RevoAI Mission Control — System Design (MVP)

## 1) Architecture Overview

## Stack
- **Frontend:** Next.js (App Router, TypeScript)
- **Backend API:** Node.js (NestJS or Express + TypeScript; recommend NestJS for modularity)
- **DB:** PostgreSQL
- **Cache/Broker:** Redis
- **Realtime:** WebSocket gateway (fallback SSE)
- **Infra:** Docker Compose (local first)

## Logical Components
1. **Web App**
   - Dashboard pages: Board, Agents, Feed, Approval Inbox, Leads, Drafts, Audit, Replay.
2. **API Service**
   - CRUD for tasks/leads/drafts/agents
   - workflow transitions + role checks
   - approval actions
   - audit write middleware
3. **Event Service (within API in MVP)**
   - Normalizes domain events
   - Stores event + audit records
   - Publishes to Redis pub/sub channel
4. **Realtime Gateway**
   - Subscribes to Redis channels
   - Pushes events to web clients (WS)
5. **Postgres**
   - Source of truth for domain + append-only logs
6. **Redis**
   - Event fanout and lightweight presence/status cache

---

## 2) Data Model (MVP)

### `users`
- id (uuid, pk)
- email (text, unique)
- role (enum: admin/operator/closer/viewer)
- password_hash (nullable in single-admin token mode)
- is_active (bool)
- created_at, updated_at

### `agents`
- id (uuid, pk)
- name (text, unique) // orchestrator, lead_finder, etc.
- status (enum: idle/running/paused/blocked)
- current_task_id (uuid, nullable)
- last_update_at (timestamptz)
- metadata (jsonb)

### `tasks`
- id (uuid, pk)
- title (text)
- description (text)
- column (enum: backlog/doing/needs_approval/done)
- priority (enum: low/med/high)
- owner_type (enum: admin/agent)
- owner_id (uuid, nullable)
- linked_lead_id (uuid, nullable)
- linked_draft_id (uuid, nullable)
- created_by (uuid)
- created_at, updated_at
- done_at (timestamptz, nullable)

### `task_events` (domain timeline)
- id (bigserial, pk)
- task_id (uuid, nullable)
- agent_id (uuid, nullable)
- event_type (text)
- payload (jsonb)
- created_by (uuid, nullable)
- created_at (timestamptz default now)

### `audit_log` (append-only immutable by app policy)
- id (bigserial, pk)
- actor_type (enum: user/agent/system)
- actor_id (uuid, nullable)
- action (text)
- resource_type (text)
- resource_id (text)
- before_state (jsonb, nullable)
- after_state (jsonb, nullable)
- metadata (jsonb)
- created_at (timestamptz default now)

### `leads`
- id (uuid, pk)
- business_name (text)
- niche (text)
- region (text)
- website (text)
- contact_name (text, nullable)
- contact_role (text, nullable)
- email (text, nullable)
- phone (text, nullable)
- source (text)
- lead_score (enum: A/B/C)
- status (enum: new/enriched/drafted/approved/contacted/replied/booked/lost)
- last_action_at (timestamptz, nullable)
- next_step (text, nullable)
- notes (jsonb) // personalization bullets array
- created_at, updated_at

### `drafts`
- id (uuid, pk)
- lead_id (uuid, nullable)
- channel (enum: email/linkedin/facebook/instagram/post/script/landing_page/ad_copy)
- draft_type (text)
- status (enum: draft/needs_approval/approved/rejected)
- current_version (int)
- approver_id (uuid, nullable)
- scheduled_send_at (timestamptz, nullable) // future use
- created_by (uuid)
- created_at, updated_at

### `draft_versions`
- id (uuid, pk)
- draft_id (uuid)
- version_number (int)
- content (text)
- change_note (text, nullable)
- created_by (uuid, nullable)
- created_at (timestamptz)

### `approvals`
- id (uuid, pk)
- draft_id (uuid)
- action (enum: approve/reject/request_changes/edit_inline_approve/approve_with_notes)
- notes (text, nullable)
- editor_content (text, nullable)
- decided_by (uuid)
- decided_at (timestamptz)

### `system_controls`
- key (text, pk) // global_pause
- value (jsonb)
- updated_by (uuid)
- updated_at (timestamptz)

---

## 3) Realtime Approach

## Event flow
1. API mutation occurs (e.g., task move, approval action).
2. Service writes transaction:
   - domain table update
   - task_events insert
   - audit_log insert
3. Service publishes compact event to Redis channel `mission_control.events`.
4. WebSocket gateway consumes and pushes to subscribed clients.
5. UI updates board/feed/cards optimistically with server confirmation.

## Event envelope
```json
{
  "id": "evt_...",
  "type": "draft.submitted_for_approval",
  "entityType": "draft",
  "entityId": "...",
  "taskId": "...",
  "agent": "copywriter",
  "timestamp": "2026-...",
  "payload": {"status": "needs_approval"}
}
```

## Why WS over SSE
- Bi-directional path for admin controls (pause/kill, inline approve edits).
- Simpler single channel for live feed + board state hints.

---

## 4) Permission / Workflow Rules
- Only Admin can:
  - mark task `done`
  - approve/reject drafts
  - inline edit + approve
  - global pause all
- Agents/operators can:
  - move tasks to doing/needs_approval
  - create/update drafts
  - emit progress events
- No draft enters "send execution" in MVP.

---

## 5) Repo Scaffold Plan

```text
revoai-mission-control/
  apps/
    web/                 # Next.js dashboard
    api/                 # NestJS/Express API + WS gateway
  db/
    migrations/
    schema.sql
  seed/
    seed.ts
    mvp_tasks.json
  docs/
    PRD.md
    SYSTEM_DESIGN.md
    VPS_DEPLOY.md
  docker-compose.yml
  .env.example
  README.md
```

---

## 6) Docker Compose Layout
Services:
- `web` (Next.js, port 3000)
- `api` (Node API + WS, port 4000)
- `postgres` (port 5432)
- `redis` (port 6379)
- optional `pgadmin` (dev convenience)

Networking:
- single compose network `mission_control_net`

Volumes:
- `pg_data`
- `redis_data`

---

## 7) MVP Build Tasks (to preload on board)
Use seeded tasks in Backlog:
1. Initialize monorepo + TypeScript tooling
2. Implement DB schema + migrations
3. Implement auth (single-admin mode)
4. Implement agents/tasks APIs
5. Implement leads + drafts + versions APIs
6. Implement approval inbox APIs + actions
7. Implement append-only audit log middleware
8. Implement realtime event bus (Redis + WS)
9. Build Kanban board UI
10. Build agent cards + controls UI
11. Build live activity feed UI
12. Build approval inbox UI
13. Build leads view + CSV export
14. Build drafts view + version history UI
15. Build audit + replay timeline view
16. Implement global pause + per-agent pause
17. Seed demo data
18. Docker compose end-to-end local run
19. Add VPS deployment guide
20. QA pass + UAT checklist
