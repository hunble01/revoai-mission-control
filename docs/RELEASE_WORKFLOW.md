# Release & Versioning Workflow

Scope: tagging, changelog, deploy record, rollback point tracking.

## 1) Create release checkpoint

```bash
ops/deploy/release-checkpoint.sh 2026.03.07-mvp
```

Output:
- git tag: `release-<version>`
- changelog update: `docs/CHANGELOG.md`

## 2) Deploy release

```bash
ops/deploy/deploy.sh
```

Deploy records are appended to:
- `.deploy/deploy-records.jsonl`

## 3) Rollback when needed

```bash
ops/deploy/rollback.sh
```

## Tracking files

- `.deploy/last_successful_release`
- `.deploy/last_rollback_point`
- `.deploy/deploy-records.jsonl`

## npm shortcuts

- `npm run deploy:artifact`
- `npm run deploy:run`
- `npm run deploy:rollback`
- `npm run release:checkpoint -- <version>`
