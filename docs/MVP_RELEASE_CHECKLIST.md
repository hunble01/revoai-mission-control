# MVP Release Readiness Checklist

## 1) Environment sanity
- [ ] `ADMIN_TOKEN` is set
- [ ] `NEXT_PUBLIC_ADMIN_TOKEN` matches `ADMIN_TOKEN`
- [ ] `DATABASE_URL` points to reachable DB
- [ ] `REDIS_URL` points to reachable Redis
- [ ] `npm run sanity:env` passes
- [ ] Do **not** `source .env` directly if values contain shell-special chars; prefer Compose env injection or explicit exported vars

## 2) Build sanity
- [ ] `npm -w apps/api run build` passes
- [ ] `npm -w apps/web run build` passes

## 3) Seed sanity
- [ ] API is running and reachable at `http://127.0.0.1:3001`
- [ ] `npm run sanity:seed` passes (`POST /api/seed/load`)

## 4) MVP smoke sanity
- [ ] `npm run smoke:mvp` passes (import + leads + approvals)
- [ ] Verify generated report artifacts in `docs/MVP_SMOKE_REPORT.md`

## 5) Operator handoff
- [ ] Keep one active campaign enabled for imports
- [ ] Verify admin token in operator environment before shifts
- [ ] Confirm approval queue loads and decisions refresh queue
- [ ] Confirm leads status updates persist and are auditable

## One-shot command
```bash
npm run readiness:mvp
```
