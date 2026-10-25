#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE_DEFAULT="${ROOT_DIR}/env/profiles/prod.env"
ENV_FILE="${ENV_FILE:-${ENV_FILE_DEFAULT}}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups/postgres}"
DRY_RUN="${DRY_RUN:-0}"
VERIFY_DB="restore_verify_$(date -u +%Y%m%d%H%M%S)"

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "[dry-run] restore verify using latest backup in ${BACKUP_DIR} -> ${VERIFY_DB}"
  echo "[dry-run] checks: table presence + row counts"
  exit 0
fi

LATEST_BACKUP="$(ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null | head -n 1 || true)"
if [[ -z "${LATEST_BACKUP}" ]]; then
  echo "No backup file found in ${BACKUP_DIR}"
  exit 1
fi

"${ROOT_DIR}/ops/backup/postgres-restore.sh" "${LATEST_BACKUP}" "${VERIFY_DB}"

COMPOSE_CMD="docker compose --env-file '${ENV_FILE}' -f '${ROOT_DIR}/docker-compose.yml'"
DB_USER="$(grep '^POSTGRES_USER=' "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true)"
[[ -z "${DB_USER}" ]] && DB_USER="mission"

${COMPOSE_CMD} exec -T postgres sh -lc "psql -U '${DB_USER}' -d '${VERIFY_DB}' -c \"SELECT COUNT(*) AS campaigns FROM \\\"Campaign\\\";\""
${COMPOSE_CMD} exec -T postgres sh -lc "psql -U '${DB_USER}' -d '${VERIFY_DB}' -c \"SELECT COUNT(*) AS leads FROM \\\"Lead\\\";\""
${COMPOSE_CMD} exec -T postgres sh -lc "psql -U '${DB_USER}' -d '${VERIFY_DB}' -c \"SELECT COUNT(*) AS drafts FROM \\\"Draft\\\";\""

${COMPOSE_CMD} exec -T postgres sh -lc "dropdb -U '${DB_USER}' --if-exists '${VERIFY_DB}'"

echo "Restore verification succeeded for ${LATEST_BACKUP}"
