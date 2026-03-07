#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE_DEFAULT="${ROOT_DIR}/env/profiles/prod.env"
ENV_FILE="${ENV_FILE:-${ENV_FILE_DEFAULT}}"
BACKUP_FILE="${1:-}"
TARGET_DB="${2:-mission_control}"
DRY_RUN="${DRY_RUN:-0}"

run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] $*"
  else
    eval "$*"
  fi
}

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: postgres-restore.sh <backup_file.dump> [target_db]"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

COMPOSE_CMD="docker compose --env-file '${ENV_FILE}' -f '${ROOT_DIR}/docker-compose.yml'"
run "${COMPOSE_CMD} up -d postgres >/dev/null"

DB_USER="$(grep '^POSTGRES_USER=' "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true)"
[[ -z "${DB_USER}" ]] && DB_USER="mission"

if [[ "${DRY_RUN}" != "1" ]]; then
  ${COMPOSE_CMD} exec -T postgres sh -lc "psql -U '${DB_USER}' -d postgres -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${TARGET_DB}' AND pid <> pg_backend_pid();\""
  ${COMPOSE_CMD} exec -T postgres sh -lc "dropdb -U '${DB_USER}' --if-exists '${TARGET_DB}'"
  ${COMPOSE_CMD} exec -T postgres sh -lc "createdb -U '${DB_USER}' '${TARGET_DB}'"
  cat "${BACKUP_FILE}" | ${COMPOSE_CMD} exec -T postgres sh -lc "pg_restore -U '${DB_USER}' -d '${TARGET_DB}' --no-owner --no-privileges"
fi

echo "Restored ${BACKUP_FILE} -> ${TARGET_DB}"
