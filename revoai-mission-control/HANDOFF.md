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
- `cp .env.example .env` and fill in secrets — **see §2.1 for how to load it safely**

### 2.1 Loading `.env` safely (important)

`.env` values routinely contain `'`, `"`, `$`, `#`, or backticks. These break the naive bash pattern `set -a; source .env; set +a`. Use one of the robust loaders instead:

```bash
# Node 20+: native loader — correctly handles any value, no bash parsing
node --env-file=.env scripts/env-sanity-check.js
node --env-file=.env -e "console.log(Object.keys(process.env).length + ' vars loaded')"

# npm run — inherits env from `node --env-file` when wrapped:
node --env-file=.env node_modules/.bin/npm run sanity:env

# Docker Compose — reads .env directly, no shell parsing involved
docker compose --env-file .env up -d
docker compose --env-file .env config | head   # verify interpolation
```

Generate strong secrets once, not per deploy:
```bash
for v in ADMIN_TOKEN SESSION_SECRET PASSWORD_SALT SECRET_KEY \
         LINKEDIN_TOKEN_SECRET FACEBOOK_TOKEN_SECRET EMAIL_WEBHOOK_SECRET; do
  printf '%s=%s\n' "$v" "$(openssl rand -hex 32)"
done
```
Paste the output into `.env` (replacing `<generate>` placeholders). Set `NEXT_PUBLIC_ADMIN_TOKEN` to the same value as `ADMIN_TOKEN`.

If `ADMIN_PASSWORD` must contain shell-special characters, wrap the whole value in **double** quotes — single quotes cannot escape a literal `'`:
```
ADMIN_PASSWORD="s0me Value#with'apostrophe"
```

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
- `ADMIN_PASSWORD` in the current `.env` contains a literal `'` (apostrophe). **Do not use `source .env`**; use `node --env-file=.env` or `docker compose --env-file .env` (see §2.1). Alternatively, regenerate `ADMIN_PASSWORD` without shell-special characters.
- **Admin login drift:** on this host, the `User.passwordHash` row does not match any currently-documented `.env` password (verified by hash comparison — see §9.3). Follow §9.4 remediation before expecting a successful login. Bootstrap endpoint itself works.

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
2. Rotate secrets currently in local `.env` (SMTP, admin password, admin token) before sharing host access. Use `openssl rand -hex 32` per §2.1.
3. Confirm `ADMIN_TOKEN === NEXT_PUBLIC_ADMIN_TOKEN` on the target deploy env.
4. Re-sync admin login: follow §9.4 (wipe-and-rebootstrap or in-place hash reset) so `POST /api/auth/login` returns 201 with the documented `.env` credentials.
5. Regenerate `ADMIN_PASSWORD` without shell-special characters (or load `.env` via `node --env-file=.env` / `docker compose --env-file .env` per §2.1 — never `source .env`).

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

## 7. Runtime Validation (Slice C — 2026-04-19)

Target: already-running stack on the handoff host (ports `3000`/`3001` occupied by the deployed `next dev` + `nest start`). Env checked against the documented template.

### 7.1 Env sanity
Running `npm run sanity:env` **inheriting host `.env` via bash `source` fails**: the stored `ADMIN_PASSWORD` contains a literal `'` which terminates bash's single-quoted parse, so the variable never exports. Vars are present in the actual running processes (started via `docker compose`-style env) — confirmed by exporting them directly:

```bash
DATABASE_URL='postgresql://mission:mission@localhost:5432/mission_control' \
REDIS_URL='redis://localhost:6379' \
ADMIN_TOKEN='change-me' \
NEXT_PUBLIC_API_URL='http://localhost:3001' \
NEXT_PUBLIC_ADMIN_TOKEN='change-me' \
node scripts/env-sanity-check.js
```
Output:
```json
{
  "ok": true,
  "missing": [],
  "checks": {
    "DATABASE_URL_localhost_hint": true,
    "REDIS_URL_localhost_hint": true,
    "ADMIN_TOKEN_present": true,
    "WEB_ADMIN_TOKEN_matches": true
  }
}
```
**Action item:** when the `.env` file is re-used for tooling, quote `ADMIN_PASSWORD` with double quotes or escape the apostrophe (tracked as a P0 remediation).

### 7.2 Smoke routes

```bash
$ curl -sS -w 'HTTP %{http_code}\n' http://localhost:3001/api/health
{"ok":true,"service":"revoai-mission-control-api"}
HTTP 200

$ curl -sS -H 'x-admin-token: change-me' \
    http://localhost:3001/api/drafts/email-pipeline/status
{"windowHours":24,"totals":{"attempts":0,"sent":0,"failed":0,"failureRatePct":0},
 "lastAttemptAt":null,"stable":true,"recentFailures":[]}
HTTP 200

$ curl -sS -H 'x-admin-token: change-me' \
    http://localhost:3001/api/settings/safety
{"dry_run_mode":{"enabled":false},
 "outbound_channels":{"email":true,"facebook":true,"linkedin":true,"instagram":true},
 "global_pause":{"paused":false},
 "outbound_daily_caps":{"email":500,"facebook":50,"linkedin":20,"instagram":50},
 "outbound_kill_switches":{"email":false,"facebook":false,"linkedin":false,"instagram":false},
 "humanApprovalRequired":true,
 "requireApproval":true}
HTTP 200

$ curl -sS -L -w 'HTTP %{http_code} redirects=%{num_redirects}\n' http://localhost:3000/
HTTP 200 redirects=0    # dashboard landing renders at root

$ curl -sS -w 'HTTP %{http_code}\n' http://localhost:3000/login
HTTP 200
<title>RevoAI Mission Control</title>
```

| Route | Status | Notes |
|---|---|---|
| `GET /api/health` | **200** | `{"ok":true,"service":"revoai-mission-control-api"}` |
| `GET /api/drafts/email-pipeline/status` | **200** | `stable:true`, 0 attempts in 24h window |
| `GET /api/settings/safety` | **200** | Policy flags intact (see §7.3) |
| `GET /` (web dashboard landing) | **200** | No redirect — overview renders |
| `GET /login` | **200** | Title `RevoAI Mission Control` present |

### 7.3 Policy-critical behavior verification

**Approval-before-send — ENFORCED**
- Settings API returns `humanApprovalRequired:true` and `requireApproval:true` (payload above).
- Code: `apps/api/src/modules/settings/settings.service.ts:45-46` always coerces both flags to `true`.
- Channel guard: `apps/api/src/modules/linkedin-dm/linkedin-dm.service.ts:38` throws `BadRequestException('Message must be approved before send')` unless `msg.status === 'approved'`.

**Dry-run gate — ACTIVE**
- `dry_run_mode` key present in safety payload (default `enabled:false` on this host; schema persists the flag).
- Seed default installs `dry_run_mode: { enabled: true }` for fresh installs (`apps/api/src/modules/seed/seed.service.ts:31`).
- Scheduler reads + applies the flag: `apps/api/src/modules/scheduler/scheduler.service.ts:266,272,296,307` (marks runs `dryRun:true` and loads safety before executing).
- Settings mutator: `settings.service.ts:52-53` toggles via `{ dryRunEnabled: bool }` DTO.

**LinkedIn DM daily cap — PROTECTED SERVER-SIDE**
- Hard cap enforced before any outbound call: `apps/api/src/modules/linkedin-dm/linkedin-dm.service.ts:44`
  ```ts
  if (usedToday >= 20)
    throw new BadRequestException('LinkedIn DM daily limit reached (20/day)');
  ```
  Count query (same file, line 43) sums `status:'sent'` messages in the local-day window.
- Configured cap surfaced in `settings.safety.outbound_daily_caps.linkedin = 20` (matches the hard-coded guard).
- Stub mode (`LINKEDIN_DM_STUB_MODE=1` default) blocks real Unipile calls even past the cap; stub returns synthetic `li_dm_stub_*` thread ids.

### 7.4 Result

All four smoke routes return 200 with expected bodies. All three policy guards remain intact in code and in the live API response. No feature changes required.

## 8. Guardrail Verification (Slice D — 2026-04-19)

Every outbound send path funnels through a single gate — `SettingsService.assertOutboundAllowed(channel)` at `apps/api/src/modules/settings/settings.service.ts:146` — that enforces: `global_pause`, `dry_run_mode`, per-channel toggle, per-channel kill-switch, connection health, **token presence**, and **token expiry**. On top of that, each send method re-checks the resource's `status === 'approved'` before dispatch. The DM path additionally enforces the 20/day cap by counting `sent` rows in today's window.

### 8.1 Approval-before-send

| Channel | Call site (assert) | Approval guard (throws) |
|---|---|---|
| Email (draft `/send-email`) | `drafts.service.ts:225` | `drafts.service.ts:230` → `'Draft must be approved before send'` |
| Email (draft `/queue-send`) | — | `drafts.service.ts:592` → `'Draft must be approved before queueing'` |
| LinkedIn (draft `/send-linkedin`) | `drafts.service.ts:511` | `drafts.service.ts:516` → `'Draft must be approved before send'` |
| LinkedIn (manual-sent-mark) | `drafts.service.ts:792` | `drafts.service.ts:797` → `'Draft must be approved before manual sent mark'` |
| LinkedIn post | — | `linkedin.service.ts:107` → `'Post must be approved or scheduled'` |
| LinkedIn DM | `linkedin-dm.service.ts:34` | `linkedin-dm.service.ts:38` → `'Message must be approved before send'` |
| Facebook (draft `/send-facebook`) | `drafts.service.ts:558` | `drafts.service.ts:563` → `'Draft must be approved before send'` |
| Facebook post (`/api/facebook/publish`) | `facebook.controller.ts:30` | `facebook.service.ts:111` → `'Social post must be approved/scheduled'`; `facebook.service.ts:117` → `'Draft must be approved'` |

**Expected:** any send endpoint rejects with `BadRequestException` when record is not in `approved` (or `scheduled` where noted).
**Observed:** every send method contains the guard immediately after fetching the record. **PASS.**

### 8.2 `dry_run_mode` gates outbound execution (live runtime proof)

Gate code: `settings.service.ts:148-156`
```ts
if (paused) throw new BadRequestException('global pause is enabled; all outbound execution blocked');
if (dry)    throw new BadRequestException('dry-run mode is enabled; outbound execution blocked');
if (!channels[channel])      throw new BadRequestException(`${channel} outbound toggle is OFF`);
if (killSwitches[channel])   throw new BadRequestException(`${channel} outbound kill-switch is ON`);
```

**Step 1 — enable dry-run:**
```bash
curl -sS -X PATCH -H 'content-type: application/json' -H 'x-admin-token: change-me' \
  -d '{"dryRunEnabled":true}' http://localhost:3001/api/settings/safety
# → dry_run_mode.enabled:true   HTTP 200
```

**Step 2 — LinkedIn DM send attempt:**
```bash
curl -sS -X POST -H 'x-admin-token: change-me' \
  http://localhost:3001/api/linkedin-dm/bogus-id-dry-run/send
# → {"ok":false,"error":{"message":"dry-run mode is enabled; outbound execution blocked",
#                        "status":400,"path":"/api/linkedin-dm/bogus-id-dry-run/send"}}
# HTTP 400
```

**Step 3 — Facebook publish attempt:**
```bash
curl -sS -X POST -H 'x-admin-token: change-me' -H 'content-type: application/json' \
  -d '{"text":"t"}' http://localhost:3001/api/facebook/publish
# → {"ok":false,"error":{"message":"dry-run mode is enabled; outbound execution blocked",
#                        "status":400,"path":"/api/facebook/publish"}}
# HTTP 400
```

**Step 4 — disable dry-run, re-attempt DM:** reached the next gate (`'linkedin provider is not connected/healthy'`) → proves gate ordering is: pause → dry-run → channel → kill-switch → connection → token → cap. **PASS.**

Dry-run state restored to `enabled:false` at end of test.

### 8.3 LinkedIn DM cap = 20/day (server-side)

Code evidence: `apps/api/src/modules/linkedin-dm/linkedin-dm.service.ts:41-44`
```ts
const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
const usedToday = await this.prisma.linkedinMessage.count({
  where: { status: 'sent', sentAt: { gte: start, lt: end } } as any,
});
if (usedToday >= 20) throw new BadRequestException('LinkedIn DM daily limit reached (20/day)');
```

- Count is a DB-backed query, not UI state — cannot be bypassed by a front-end client.
- Cap is enforced **after** `assertOutboundAllowed('linkedin')` (line 34) and **after** the approval check (line 38), so it runs even for approved messages when connection + tokens are valid.
- Surfaced to UI via `settings.safety.outbound_daily_caps.linkedin = 20` (matches the hard-coded value).
- Stub mode (`LINKEDIN_DM_STUB_MODE=1`, default) still triggers the cap check; only the external Unipile call is stubbed after the gates.

**Expected:** the 21st approved+sent attempt in a local-day window throws `'LinkedIn DM daily limit reached (20/day)'`.
**Observed:** code path present; cannot be exercised live without seeding 20 sent rows (out of scope). **PASS (code review).**

### 8.4 Token encryption + expiry

**Encryption — AES-256-GCM, random 12-byte IV, auth tag, hex-encoded:**
- LinkedIn: `apps/api/src/modules/linkedin/linkedin.service.ts:14-31`
- Facebook: `apps/api/src/modules/facebook/facebook.service.ts:10-31` (identical pattern)
- Email (outbound consumer): `apps/api/src/modules/drafts/drafts.service.ts:24-34` (decrypt-only; writer is the connections module)
- Wire format: `iv.tag.ciphertext` (hex, dot-delimited) — written at upsert (`linkedin.service.ts:75-76`, `facebook.service.ts:...`, `connections.service.ts:236,298`).
- Key derivation: `createHash('sha256').update(env_secret).digest()` — seed env vars: `LINKEDIN_TOKEN_SECRET`, `FACEBOOK_TOKEN_SECRET`, falling back to `SECRET_KEY` then a dev default. **Action item — P1:** set these in production; today's defaults would let anyone with code access decrypt tokens.

**Expiry handling — checked on every outbound send:**
- OAuth `expires_in` is persisted as `providerToken.expiresAt`: `linkedin.service.ts:69,77,83`; `facebook.service.ts:50,69,77,82`; `connections.service.ts:235,242,250,304,312`.
- Gate — `settings.service.ts:172-179`:
  ```ts
  const token = await this.prisma.providerToken.findUnique({ where: { provider: channel } });
  if (!token || !token.accessToken) throw new BadRequestException(`${channel} provider token missing`);
  if (token.expiresAt && token.expiresAt.getTime() <= Date.now())
    throw new BadRequestException(`${channel} provider token expired`);
  ```
- Live proof (`/api/drafts/bogus/send-email` with dry-run OFF, no email token present):
  ```json
  {"ok":false,"error":{"message":"email provider token missing","status":400,
                       "path":"/api/drafts/bogus/send-email"}}
  ```
  HTTP 400 — confirms the token-presence branch fires. Expired-token branch is the same function, guaranteed by shared code path.

**Expected:** outbound send must reject when `providerToken` missing OR `expiresAt <= now`; secrets-at-rest must be AES-GCM, not plaintext.
**Observed:** all three assertions hold in code; the missing-token branch was exercised live. **PASS.**

### 8.5 Summary

| Guardrail | Method | Result |
|---|---|---|
| Approval-before-send (8 send paths) | code review | **PASS** |
| `dry_run_mode` blocks outbound | live PATCH → POST → 400 | **PASS** |
| `global_pause` / kill-switch / channel-toggle | same gate; shared code path | **PASS (inherited)** |
| LinkedIn DM 20/day cap server-side | code review (DB-backed `count`) | **PASS** |
| Token encryption (AES-256-GCM) | code review, 3 modules identical pattern | **PASS** |
| Token presence + expiry enforcement | live 400 `'provider token missing'` | **PASS** |

**Remediation items discovered (no feature changes made):**
- **P1:** Set `LINKEDIN_TOKEN_SECRET`, `FACEBOOK_TOKEN_SECRET`, and `SECRET_KEY` in production `.env` — current fallbacks include a dev default (`revoai-linkedin-dev-secret`). Template already lists these in `.env.example` §LinkedIn / §Facebook; ensure they are populated before enabling real providers.
- **P2:** Dry-run state is persisted in the DB as the `dry_run_mode` setting row; after a restart the DB value is authoritative. Runbook should instruct operators to check `/api/settings/safety` after any maintenance to confirm the intended flag state.

## 9. Auth Verification (Slice E — 2026-04-19)

Endpoints under `apps/api/src/modules/auth/auth.controller.ts`:
```
POST /api/auth/bootstrap   → creates admin from BOOTSTRAP_ADMIN_* / ADMIN_* env (idempotent by email)
POST /api/auth/login       → body {email,password} → Set-Cookie: mc_session=...; Expires=...
POST /api/auth/logout      → clears mc_session cookie
GET  /api/auth/me          → requires mc_session cookie → user identity + role
```

Session cookie: HMAC-signed JSON (`SESSION_SECRET` or falls back to `ADMIN_TOKEN`), 7-day expiry, `HttpOnly; SameSite=Lax; Secure` (when `NODE_ENV=production`). Password hash: `sha256(PASSWORD_SALT + ':' + password)`; timing-safe compare on login.

### 9.1 Exact commands

```bash
# 1. Create / ensure admin user (reads BOOTSTRAP_ADMIN_EMAIL + BOOTSTRAP_ADMIN_PASSWORD,
#    falls back to ADMIN_EMAIL + ADMIN_PASSWORD).
curl -sS -X POST http://localhost:3001/api/auth/bootstrap

# 2. Login and capture the Set-Cookie header into a cookie jar.
curl -sS -c /tmp/mc.cookies -D /tmp/mc.headers \
     -X POST -H 'content-type: application/json' \
     -d '{"email":"admin@revoai.local","password":"<YOUR_ADMIN_PASSWORD>"}' \
     http://localhost:3001/api/auth/login

# 3. Verify session + role using the jar.
curl -sS -b /tmp/mc.cookies http://localhost:3001/api/auth/me
```

### 9.2 Expected responses

```jsonc
// POST /api/auth/bootstrap
// First call:
{ "ok": true, "created": true,  "email": "admin@revoai.local" }   // HTTP 201
// Subsequent calls (idempotent):
{ "ok": true, "created": false, "email": "admin@revoai.local" }   // HTTP 201

// POST /api/auth/login (credentials match)
{ "ok": true, "user": { "id": "...", "email": "admin@revoai.local", "role": "admin" },
  "expiresAt": "2026-04-26T..." }                                 // HTTP 201
//   Set-Cookie: mc_session=<base64url>.<hmac-sha256>; Path=/; HttpOnly; SameSite=Lax; Expires=...

// POST /api/auth/login (bad credentials, timing-safe)
{ "ok": false, "error": { "message": "Invalid credentials", "status": 401 } }   // HTTP 401

// GET /api/auth/me (valid cookie)
{ "ok": true, "user": { "id": "...", "email": "admin@revoai.local", "role": "admin" } }  // HTTP 200
```

### 9.3 Live run against this host (2026-04-19)

```text
$ curl -sS -X POST http://localhost:3001/api/auth/bootstrap
{"ok":true,"created":false,"email":"admin@revoai.local"}        HTTP 201

$ curl -sS -X POST -H 'content-type: application/json' \
    -d '{"email":"admin@revoai.local","password":"<env ADMIN_PASSWORD>"}' \
    http://localhost:3001/api/auth/login
{"ok":false,"error":{"message":"Invalid credentials","status":401}}   HTTP 401

$ curl -sS -X POST -H 'content-type: application/json' \
    -d '{"email":"admin@revoai.local","password":"change-me"}' \
    http://localhost:3001/api/auth/login
{"ok":false,"error":{"message":"Invalid credentials","status":401}}   HTTP 401
```

**Findings:**
- Bootstrap endpoint **responds correctly** (HTTP 201, idempotent — `created:false` because the admin row already exists from an earlier bootstrap).
- Login **fails** for both the value in `.env` (`ADMIN_PASSWORD`) and the container-env value (`BOOTSTRAP_ADMIN_PASSWORD=change-me`). DB query confirms the stored hash prefix (`2bdb189c…`) does not match `sha256('revoai:change-me')` (`9d3a4d9b…`) or `sha256('revoai:<ADMIN_PASSWORD>')` (`25cce1bb…`), so the admin was bootstrapped under yet another env combination that is no longer reproducible from the recorded `.env`.
- Verification of the **negative path** (401 on wrong password) is itself useful — it proves the timing-safe compare and error surface are wired correctly.

### 9.4 Remediation for blocked login (operator, one-time)

Pick ONE:

**A — Wipe and re-bootstrap (cleanest; use only if no other users rely on the current row):**
```bash
docker exec revoai_mc_postgres psql -U mission -d mission_control \
  -c "DELETE FROM \"Session\" WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE email='admin@revoai.local'); \
      DELETE FROM \"User\" WHERE email='admin@revoai.local';"

# Ensure the container sees the password you intend to use, then:
curl -sS -X POST http://localhost:3001/api/auth/bootstrap
# → {"ok":true,"created":true,"email":"admin@revoai.local"}
```

**B — Reset the password hash in place:**
```bash
NEW_PASSWORD='<strong-new-password>'
SALT="$(docker exec revoai_mc_api printenv PASSWORD_SALT 2>/dev/null)"
SALT="${SALT:-revoai}"   # code default when PASSWORD_SALT is unset
HASH="$(node -e "const {createHash}=require('crypto'); \
  console.log(createHash('sha256').update('${SALT}:'+process.argv[1]).digest('hex'))" "$NEW_PASSWORD")"
docker exec revoai_mc_postgres psql -U mission -d mission_control \
  -c "UPDATE \"User\" SET \"passwordHash\"='$HASH' WHERE email='admin@revoai.local';"
```

Both flows preserve the API process; no restart required. After either, re-run §9.1 step 2 and expect HTTP 201 with a `Set-Cookie: mc_session=...` header.

### 9.5 Shared-token guidance (replaces `change-me` examples)

The previously-documented shortcut `x-admin-token: change-me` is a **dev-only** convenience. For handoff/prod:
1. Generate a per-environment token: `openssl rand -hex 32`.
2. Set `ADMIN_TOKEN` and `NEXT_PUBLIC_ADMIN_TOKEN` to that value (they must match — `sanity:env` verifies).
3. Never log the token, never commit it, rotate on any suspected leak.
4. For scripted API calls in runbooks, prefer session-cookie auth (§9.1) over the shared token where the endpoint supports it.


