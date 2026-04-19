# Mission Control — Handoff (Slice B)

Canonical repo: `revoai-mission-control`
Branch: `handoff/mission-control-final`
Date: 2026-04-19

## 1. Shipped architecture

Monorepo (`npm` workspaces) with two apps:

### `apps/api` — NestJS 10 (Node + TypeScript, CommonJS)
- Postgres via Prisma 5 (schema: `apps/api/prisma/schema.prisma`)
- Redis via `ioredis`
- Realtime via `@nestjs/platform-socket.io` (WebSocket gateway)
- Email via `nodemailer` (IONOS SMTP or generic SMTP)
- Auth: session + RBAC cutover (bootstrap admin flow, shared `ADMIN_TOKEN` kept for service calls)
- HTTP health endpoint: `GET /api/health`

Modules registered in `apps/api/src/app.module.ts`:
```
events, approvals, settings, campaigns, scheduler, leads, drafts,
tasks, agents, feed, audit, seed, auth, alerts, connections,
research, search, social-posts, linkedin, linkedin-dm, facebook,
analytics, content
```

Prisma migrations (applied in order):
```
20260307073000_auth_cutover
20260308031500_connections_foundation
20260308051500_connection_health
20260308054500_outbound_send_email
20260308092000_research_hub_phase1
20260308094500_lead_research_fields
20260308101500_social_posts_phase2
20260308103000_provider_tokens_phase3
20260308104000_linkedin_messages_phase5
20260308105000_scheduler_job_type_phase7
20260309022000_campaign_system_fields
20260309033000_campaign_messaging_brand_settings
20260309065000_research_campaign_filters
20260309100000_content_intelligence
20260320023000_slice01_schema_foundation
```

### `apps/web` — Next.js 14.2 (App Router, React 18)
Pages under `apps/web/app/`:
```
agents, analytics, approvals, audit, board, campaigns, connections,
content, content-calendar, drafts, email, facebook, feed, health,
help, leads, linkedin, login, research, scheduler, settings, tasks
```
- Server-side calls via `INTERNAL_API_URL` (defaults to `http://api:3001`)
- Browser calls via `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3001`)
- Socket.io client for live feed/approvals/scheduler updates

### Infra
- `docker-compose.yml` runs: `postgres:16`, `redis:7`, `api`, `web`
- `ops/deploy/` — release-artifact, deploy, rollback, release-checkpoint scripts
- `ops/backup/` — postgres backup, restore, restore-verify scripts

## 2. Run / build / deploy

### Prerequisites
- Node 22 (Alpine image for web container uses `node:22-alpine`)
- Docker + Docker Compose (for DB/Redis; full stack optional)
- `cp .env.example .env` and fill in secrets

### Local dev (bare metal — requires Postgres + Redis running)
```bash
npm install
# start DB + Redis via compose (leave api/web off)
docker compose up -d postgres redis
npm -w apps/api run prisma:generate
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
npm run dev            # spawns api (3001) + web (3000)
# or individually:
npm run dev:api
npm run dev:web
```

### Local dev (full Docker)
```bash
docker compose up -d
# tails:
docker compose logs -f api web
```

### Build (for deploy artifact)
```bash
npm run sanity:env               # verifies required env vars
npm -w apps/api run build
npm -w apps/web run build
npm run sanity:seed
# or the aggregate:
npm run readiness:mvp
```

### Smoke / integration / UAT
```bash
npm run smoke:mvp
npm run test:integration:mvp
npm run test:ui:smoke
npm run uat:final                # writes docs/FINAL_UAT_REPORT.json
```

### Deploy / rollback
```bash
npm run deploy:artifact          # build tarball in artifacts/
npm run deploy:run               # ops/deploy/deploy.sh
npm run deploy:rollback          # ops/deploy/rollback.sh
npm run release:checkpoint
```

### Backup / restore
```bash
npm run backup:postgres
npm run restore:postgres
npm run restore:verify
```

## 3. Known blockers (from baseline)

- **Missing env vars** (`scripts/env-sanity-check.js` will fail without these):
  - `DATABASE_URL`
  - `REDIS_URL`
  - `ADMIN_TOKEN`
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_ADMIN_TOKEN` (must equal `ADMIN_TOKEN` for the web shell to call the API)
- **Port 3000 already in use** on the handoff host — web dev server will fail to bind.
  - Check: `ss -tlnp | grep :3000`
  - Either stop the existing process (likely a stray `next dev`) or run with `PORT=3002 npm run dev:web`.
  - Port `3001` (api) is similarly occupied on this host — same remediation.
- `.env` on the host currently contains real SMTP credentials; it is git-ignored but should be rotated before broader access.

## 4. UAT / smoke checklist

Pre-flight:
- [ ] `.env` populated from `.env.example`; `ADMIN_TOKEN === NEXT_PUBLIC_ADMIN_TOKEN`
- [ ] Postgres reachable at `DATABASE_URL`; migrations applied (`prisma migrate deploy`)
- [ ] Redis reachable at `REDIS_URL`
- [ ] `npm run sanity:env` → `ok: true`
- [ ] `npm -w apps/api run build` clean
- [ ] `npm -w apps/web run build` clean

API smoke:
- [ ] `GET /api/health` → 200
- [ ] `POST /api/auth/bootstrap` creates admin
- [ ] `GET /api/auth/me` with session returns role
- [ ] `GET /api/alerts` returns `import_failures_24h`, `approvals_stall_2h`, `scheduler_failures_24h`
- [ ] `GET /api/feed` streams via Socket.io

Web smoke (visit each, confirm no 500s and data renders):
- [ ] `/login` — login with bootstrap admin
- [ ] `/` overview — Operational Alerts card visible
- [ ] `/approvals` — list + approve/reject
- [ ] `/scheduler` — queue state, job retry
- [ ] `/campaigns` — create, edit, launch
- [ ] `/drafts` — compose, schedule
- [ ] `/content-calendar` — scheduled posts visible
- [ ] `/connections` — provider cards render
- [ ] `/feed` — live activity
- [ ] `/analytics` — KPIs render
- [ ] `/audit` — recent events
- [ ] `/health` — all green

Automated:
- [ ] `npm run readiness:mvp` → exits 0
- [ ] `npm run test:mvp:all` → all pass
- [ ] `npm run uat:final` → `docs/FINAL_UAT_REPORT.json` status PASS

## 5. Prioritized remaining tasks

P0 — unblock handoff host:
1. Free ports 3000/3001 on the handoff box (or document an alt-port runbook).
2. Rotate secrets currently in local `.env` (SMTP, admin password, admin token) before sharing host access.
3. Confirm `ADMIN_TOKEN === NEXT_PUBLIC_ADMIN_TOKEN` on the target deploy env.

P1 — production readiness:
4. Verify all 15 migrations applied on the target DB (`prisma migrate status`).
5. Seed bootstrap admin on target DB (`POST /api/auth/bootstrap`).
6. Run `npm run uat:final` against the deployed URLs and attach report.
7. Wire real provider credentials (LinkedIn, Facebook, Unipile, Apollo, Hunter) — currently stub-mode by default.

P2 — hardening:
8. Switch `OAUTH_STUB_MODE`, `FACEBOOK_STUB_MODE`, `LINKEDIN_STUB_MODE`, `LINKEDIN_DM_STUB_MODE` to `0` once real credentials verified.
9. Configure `EMAIL_WEBHOOK_SECRET` and inbound email routing.
10. Populate `PASSWORD_SALT` and `SESSION_SECRET` with strong random values (not `change-me`).
11. Observability: review `docs/OBSERVABILITY_ALERTS.md` and wire external alerting.
12. Backups: schedule `npm run backup:postgres` and verify with `npm run restore:verify`.

## 6. Reference docs (in-repo)

- `docs/SYSTEM_DESIGN.md` — architecture overview
- `docs/PRD.md` — product requirements
- `docs/AUTH_SESSION_RBAC.md` — auth model
- `docs/ENV_CONFIG_MATRIX.md` — env var matrix
- `docs/DEPLOY_PIPELINE.md`, `docs/VPS_DEPLOY.md` — deploy
- `docs/BACKUP_RESTORE.md` — backup/restore
- `docs/CONNECTIONS_OAUTH_SETUP.md` — OAuth setup per provider
- `docs/OBSERVABILITY_ALERTS.md` — alerts/metrics
- `docs/MVP_RELEASE_CHECKLIST.md`, `docs/MVP_SMOKE_REPORT.md` — release gates
- `docs/HANDOFF_RUNBOOK.md` — signed production handoff runbook
- `docs/MISSION_CONTROL_QA_ROLLOUT.md` — QA rollout plan
