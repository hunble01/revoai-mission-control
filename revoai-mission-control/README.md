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

## Prisma startup behavior
- API container now starts **inside `apps/api`** and runs:
  - `prisma generate --schema=prisma/schema.prisma`
  - `prisma migrate deploy --schema=prisma/schema.prisma` (if migrations exist)
  - then Nest (`nest start --watch`)
- This avoids workspace path mismatches that caused `Could not load --schema ...` errors.

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

## Local run (bulletproof)
1) Create local env file:
```bash
cp .env.example .env
```

2) Set your admin token in `.env`:
```bash
ADMIN_TOKEN=your-strong-token
NEXT_PUBLIC_ADMIN_TOKEN=your-strong-token
```

3) Start everything:
```bash
docker compose up --build
```

Then open:
- web: http://localhost:3000
- api: http://localhost:3001/api/health
- web health page: http://localhost:3000/health

## One-command rebuild + verify
Run this on the server from the repo directory:
```bash
git fetch origin && git checkout master && git reset --hard origin/master && docker compose down --remove-orphans && docker compose up --build -d && curl -fsS http://localhost:3001/api/health
```

## API URL notes (web app)
- Inside Docker network (server-side in web container): `INTERNAL_API_URL=http://api:3001`
- In local browser (client-side): `NEXT_PUBLIC_API_URL=http://localhost:3001`

## Private remote access (Tailscale, no public exposure)

### A) Preferred: Tailscale Serve
Expose the dashboard privately over your tailnet:
```bash
tailscale serve http / http://127.0.0.1:3000
```
Stop/reset serve config:
```bash
tailscale serve reset
```

### B) SSH tunnel over tailnet
Tunnel local port 3000 to remote dashboard:
```bash
ssh -L 3000:127.0.0.1:3000 user@<tailscale-host>
```
Then open `http://localhost:3000` on your local machine.

## Write endpoint protection
- `x-admin-token` is required on all write/mutate routes.
- Keep `ADMIN_TOKEN` and `NEXT_PUBLIC_ADMIN_TOKEN` secret and non-default.

## Optional hardening note
- If you ever bind services to `0.0.0.0`, restrict ports `3000`/`3001` at firewall level to `tailscale0` or CIDR `100.64.0.0/10` only.

## Notes
- This is scaffold + initial implementation.
- Next pass should add auth guards, validation DTOs, migrations, and fuller UI interactions.
