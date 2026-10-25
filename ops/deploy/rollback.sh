#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="${ROOT_DIR}/.deploy"
RUN_DIR="${ROOT_DIR}/.deploy/run"
CURRENT_LINK="${RUN_DIR}/current"
PREVIOUS_LINK="${RUN_DIR}/previous"
HOOKS_DIR="${ROOT_DIR}/ops/deploy/hooks"
ENV_FILE_DEFAULT="${ROOT_DIR}/env/profiles/prod.env"
ENV_FILE="${ENV_FILE:-${ENV_FILE_DEFAULT}}"
DRY_RUN="${DRY_RUN:-0}"
RECORD_CMD="${ROOT_DIR}/ops/deploy/record-release.sh"

run() {
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "[dry-run] $*"
  else
    eval "$*"
  fi
}

hook() {
  local name="$1"
  local path="${HOOKS_DIR}/${name}.sh"
  if [[ -x "${path}" ]]; then
    if [[ "${DRY_RUN}" == "1" ]]; then
      echo "[dry-run] hook ${name}"
    else
      "${path}"
    fi
  fi
}

if [[ ! -L "${PREVIOUS_LINK}" ]]; then
  echo "No previous release link found; cannot rollback."
  [[ "${DRY_RUN}" != "1" ]] && "${RECORD_CMD}" rollback "none" blocked "no_previous_link"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  [[ "${DRY_RUN}" != "1" ]] && "${RECORD_CMD}" rollback "none" blocked "missing_env_file"
  exit 1
fi

hook pre_rollback

PREV_TARGET="$(readlink "${PREVIOUS_LINK}")"
run "ln -sfn '${PREV_TARGET}' '${CURRENT_LINK}'"

COMPOSE_CMD="docker compose --env-file '${ENV_FILE}' -f '${CURRENT_LINK}/docker-compose.yml'"
run "${COMPOSE_CMD} up -d --force-recreate api web"
run "sleep 3"
run "curl -fsS http://127.0.0.1:3001/api/health >/dev/null"
run "curl -fsS -I http://127.0.0.1:3000 >/dev/null"

if [[ "${DRY_RUN}" != "1" ]]; then
  PREV_NAME="$(basename "${PREV_TARGET}")"
  echo "${PREV_NAME}" > "${STATE_DIR}/last_successful_release"
  "${RECORD_CMD}" rollback "${PREV_NAME}" ok "health_checks_passed"
fi

hook post_rollback

echo "Rollback complete -> $(basename "${PREV_TARGET}")"
