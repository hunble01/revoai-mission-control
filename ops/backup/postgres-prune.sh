#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-}"
RETENTION_DAYS="${2:-14}"
RETENTION_COUNT="${3:-30}"
DRY_RUN="${4:-0}"

if [[ -z "${BACKUP_DIR}" ]]; then
  echo "Usage: postgres-prune.sh <backup_dir> [retention_days] [retention_count] [dry_run]"
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

if [[ "${DRY_RUN}" == "1" ]]; then
  echo "[dry-run] find '${BACKUP_DIR}' -type f -name '*.dump' -mtime +${RETENTION_DAYS} -delete"
else
  find "${BACKUP_DIR}" -type f -name '*.dump' -mtime +"${RETENTION_DAYS}" -delete
  find "${BACKUP_DIR}" -type f -name '*.json' -mtime +"${RETENTION_DAYS}" -delete
fi

mapfile -t dumps < <(find "${BACKUP_DIR}" -maxdepth 1 -type f -name '*.dump' | sort)
COUNT="${#dumps[@]}"
if (( COUNT > RETENTION_COUNT )); then
  REMOVE=$((COUNT - RETENTION_COUNT))
  for ((i=0; i<REMOVE; i++)); do
    FILE="${dumps[$i]}"
    META="${FILE%.dump}.json"
    if [[ "${DRY_RUN}" == "1" ]]; then
      echo "[dry-run] rm -f '${FILE}' '${META}'"
    else
      rm -f "${FILE}" "${META}"
    fi
  done
fi
