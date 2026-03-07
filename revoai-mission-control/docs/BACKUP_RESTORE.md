# Postgres Backup / Restore / Verification

Scope: backup procedure, retention policy, restore procedure, restore verification drill.

## Scripts

- `ops/backup/postgres-backup.sh`
- `ops/backup/postgres-prune.sh`
- `ops/backup/postgres-restore.sh`
- `ops/backup/postgres-restore-verify.sh`

## Backup procedure

Creates compressed custom-format dump (`.dump`) and metadata (`.json`) in:
- `backups/postgres/`

Command:
```bash
ops/backup/postgres-backup.sh
```

Config (optional):
- `ENV_FILE` (default `env/profiles/prod.env`)
- `BACKUP_DIR` (default `backups/postgres`)
- `RETENTION_DAYS` (default `14`)
- `RETENTION_COUNT` (default `30`)
- `DRY_RUN=1`

## Retention policy

Applied automatically in backup script via prune script:
- delete backups older than `RETENTION_DAYS`
- cap remaining backup files to `RETENTION_COUNT` newest snapshots

## Restore procedure

Restore a specific dump to target DB:
```bash
ops/backup/postgres-restore.sh backups/postgres/mission_control-<ts>.dump mission_control
```

Behavior:
1. stop active connections to target DB
2. drop target DB (if exists)
3. recreate DB
4. restore dump with `pg_restore`

## Restore verification drill

Run drill against latest backup into temporary verification DB:
```bash
ops/backup/postgres-restore-verify.sh
```

Drill checks:
- restore succeeds
- key table counts are queryable (`Campaign`, `Lead`, `Draft`)
- verification DB is dropped after checks

## Operational notes

- Keep `env/profiles/prod.env` present for production operations.
- Start with dry run:
```bash
DRY_RUN=1 ops/backup/postgres-backup.sh
DRY_RUN=1 ops/backup/postgres-restore-verify.sh
```
