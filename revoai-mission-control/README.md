# RevoAI Mission Control (MVP Scaffold)

Phase 2: planning/build only. No outreach execution.

## Included in this scaffold
- `docs/PRD.md`
- `docs/SYSTEM_DESIGN.md`
- `db/schema.sql` (initial schema draft)
- `seed/mvp_tasks.json` (preload board tasks)
- `docker-compose.yml` (local stack layout)

## Quick start (scaffold mode)
```bash
docker compose up -d
```

Current `api` and `web` services are placeholders so architecture can be reviewed before coding.

## Next implementation steps
1. Choose API framework (recommended: NestJS)
2. Implement schema migrations from `db/schema.sql`
3. Build minimal auth (single-admin mode)
4. Implement task/agent/lead/draft/approval/audit endpoints
5. Implement Redis-backed realtime events + WS gateway
6. Build Next.js pages for board/feed/inbox/leads/drafts/audit/replay
7. Load seed tasks into DB from `seed/mvp_tasks.json`

## Notes
- Approval-gated model is mandatory.
- Append-only audit log is mandatory in MVP.
- Sender/publisher integrations are deferred to later phase.
