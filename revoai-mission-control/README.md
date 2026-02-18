# RevoAI Mission Control (MVP Scaffold)

Phase 2 = planning/build + internal automation only.

## Safety defaults (MVP)
- `dryRunMode` = ON by default
- outbound channel toggles (email/facebook/instagram/linkedin) = OFF by default
- no external send/post execution in MVP

## Included
- PRD + system design in `docs/`
- SQL schema draft in `db/schema.sql`
- NestJS + Prisma scaffold in `apps/api`
- Next.js dashboard scaffold in `apps/web`
- Seed board tasks in `seed/mvp_tasks.json`
- Docker compose for local stack

## Key API routes scaffolded
- `/api/health`
- `/api/seed/load` (seed campaign + jobs + leads + drafts + tasks/events)
- `/api/tasks`, `/api/tasks/:id/replay`
- `/api/agents`
- `/api/leads`, `/api/leads/:id/score-override`
- `/api/drafts`, `/api/drafts/:id/mark-sent-manual`
- `/api/drafts/:id/approve`
- `/api/drafts/:id/reject`
- `/api/drafts/:id/request-changes`
- `/api/drafts/:id/edit-inline-approve`
- `/api/drafts/:id/approve-with-notes`
- `/api/campaigns`
- `/api/scheduler/jobs`, `/api/scheduler/jobs/:id/run-now`, `/api/scheduler/runs`
- `/api/settings/safety`
- `/api/events/feed`
- `/api/audit`

## Auth (single-admin MVP)
- Mutating and protected routes require `x-admin-token` (or Bearer token).
- Token defaults to `change-me` in local compose and should be replaced.

## Realtime
- WebSocket event stream via Socket.IO (`activity` channel)

## Local run
```bash
docker compose up -d
```

Then open:
- web: http://localhost:3000
- api: http://localhost:4000/api/health

## Notes
- This is scaffold + initial implementation.
- Next pass should add auth guards, validation DTOs, migrations, and fuller UI interactions.
