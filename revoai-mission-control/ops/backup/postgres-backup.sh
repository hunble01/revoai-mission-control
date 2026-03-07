#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE_DEFAULT="${ROOT_DIR}/env/profiles/prod.env"
ENV_FILE="${ENV_FILE:-${ENV_FILE_DEFAULT}}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
RETENTION_COUNT="${RETENTION_COUNT:-30}"
DRY_RUN="${DRY_RUN:-0}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASENAME="mission_control-${TIMESTAMP}"
DUMP_PATH="${BACKUP_DIR}/${BASENAME}.dump"
META_PATH="${BACKUP_DIR}/${BASENAME}.json"

run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] $*"
  else
    eval "$*"
  fi
}

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

COMPOSE_CMD="docker compose --env-file '${ENV_FILE}' -f '${ROOT_DIR}/docker-compose.yml'"
run "${COMPOSE_CMD} up -d postgres >/dev/null"

if [[ "${DRY_RUN}" != "1" ]]; then
  DB_NAME="$(grep '^POSTGRES_DB=' "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true)"
  [[ -z "${DB_NAME}" ]] && DB_NAME="mission_control"
  DB_USER="$(grep '^POSTGRES_USER=' "${ENV_FILE}" 2>/dev/null | cut -d= -f2- || true)"
  [[ -z "${DB_USER}" ]] && DB_USER="mission"

  ${COMPOSE_CMD} exec -T postgres sh -lc "pg_dump -U '${DB_USER}' -d '${DB_NAME}' -Fc" > "${DUMP_PATH}"

  SHA="$(sha256sum "${DUMP_PATH}" | awk '{print $1}')"
  SIZE="$(stat -c%s "${DUMP_PATH}")"
  cat > "${META_PATH}" <<EOF
{"backup":"$(basename "${DUMP_PATH}")","timestamp":"${TIMESTAMP}","sha256":"${SHA}","bytes":${SIZE},"retentionDays":${RETENTION_DAYS},"retentionCount":${RETENTION_COUNT}}
EOF
fi

"${ROOT_DIR}/ops/backup/postgres-prune.sh" "${BACKUP_DIR}" "${RETENTION_DAYS}" "${RETENTION_COUNT}" "${DRY_RUN}"

echo "${DUMP_PATH}"
