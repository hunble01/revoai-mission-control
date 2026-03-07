# Deterministic Deploy Pipeline

Scope: build artifact, migrate, restart, rollback hooks/process.

Runtime hardening in compose:
- healthchecks on `postgres`, `redis`, `api`, `web`
- `restart: unless-stopped` for all critical services
- `init: true` + `stop_grace_period` for `api` and `web` graceful signal handling
- dependency ordering uses `condition: service_healthy`

## Artifacts and scripts

- `ops/deploy/release-artifact.sh`
- `ops/deploy/deploy.sh`
- `ops/deploy/rollback.sh`
- `ops/deploy/hooks/*.sample`

## Deterministic deploy flow

1. Generate immutable release artifact from `git archive`.
2. Extract into `.deploy/run/releases/<release-id>`.
3. Update symlinks:
   - `current` -> new release
   - `previous` -> prior current release
4. Start infra (`postgres`, `redis`) via compose with explicit env file.
5. Run migration step (Prisma `migrate deploy`) as one-off compose run.
6. Restart app services deterministically (`api`, `web`) with `--force-recreate`.
7. Run health checks:
   - `GET /api/health`
   - `HEAD /` on web port
8. Record `last_successful_release`.
9. Execute post-deploy hook if present.

## Rollback flow

1. Resolve `previous` symlink target.
2. Switch `current` back to previous release.
3. Restart `api` and `web` from rollback target.
4. Run health checks.
5. Record rollback release in `last_successful_release`.
6. Execute post-rollback hook if present.

## Required env file

Deploy/rollback scripts expect:
- `ENV_FILE` (default: `env/profiles/prod.env`)

Create from profile:
```bash
cp env/profiles/prod.env.example env/profiles/prod.env
```

## Commands

Dry-run deploy:
```bash
DRY_RUN=1 ops/deploy/deploy.sh
```

Real deploy:
```bash
ops/deploy/deploy.sh
```

Dry-run rollback:
```bash
DRY_RUN=1 ops/deploy/rollback.sh
```

Real rollback:
```bash
ops/deploy/rollback.sh
```

## Hook points

Optional executable hooks:
- `ops/deploy/hooks/pre_deploy.sh`
- `ops/deploy/hooks/post_deploy.sh`
- `ops/deploy/hooks/pre_rollback.sh`
- `ops/deploy/hooks/post_rollback.sh`

Sample hook templates are included as `.sample` files.
