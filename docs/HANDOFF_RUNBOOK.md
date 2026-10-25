# Production Handoff Runbook (Signed)

## Scope
Final handoff after:
1. Session/RBAC auth cutover
2. Workflow-linked alerts
3. Final UAT navigation/API pass

## Preflight
- `npm -w apps/api run build`
- `npm -w apps/web run build`
- `npm run readiness:mvp`

## Auth cutover runbook
1. Apply migration: `npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma`
2. Bootstrap admin: `POST /api/auth/bootstrap`
3. Login via `/login` using bootstrap admin credentials
4. Verify `/api/auth/me` returns user role
5. Confirm no shared-token-only access path remains required for UI flows

## Alerts runbook
- Verify `/api/alerts` returns:
  - `import_failures_24h`
  - `approvals_stall_2h`
  - `scheduler_failures_24h`
- Verify Overview renders Operational Alerts card

## UAT pass
Run:
```bash
node scripts/final-uat-pass.js
```
Artifacts:
- `docs/FINAL_UAT_REPORT.json`

## Sign-off
- Technical owner: Jarvis
- Business owner: Michael (Boss)
- Status: READY FOR PRODUCTION HANDOFF (pending Boss acceptance)
- Date (UTC): 2026-03-07
- Final UAT result: PASS (`docs/FINAL_UAT_REPORT.json`)

Signed:
- Jarvis ✅
