#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="${ROOT_DIR}/.deploy"
RUN_DIR="${ROOT_DIR}/.deploy/run"
RELEASES_DIR="${RUN_DIR}/releases"
CURRENT_LINK="${RUN_DIR}/current"
PREVIOUS_LINK="${RUN_DIR}/previous"
HOOKS_DIR="${ROOT_DIR}/ops/deploy/hooks"
ENV_FILE_DEFAULT="${ROOT_DIR}/env/profiles/prod.env"
ENV_FILE="${ENV_FILE:-${ENV_FILE_DEFAULT}}"
DRY_RUN="${DRY_RUN:-0}"
RELEASE_ID="${RELEASE_ID:-$(date -u +%Y%m%d%H%M%S)-$(git -C "${ROOT_DIR}" rev-parse --short HEAD)}"

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
      "${path}" "${RELEASE_ID}"
    fi
  fi
}

mkdir -p "${RELEASES_DIR}" "${STATE_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}"
  echo "Create from env/profiles/prod.env.example"
  exit 1
fi

hook pre_deploy

ARTIFACT_PATH="$(${ROOT_DIR}/ops/deploy/release-artifact.sh "${RELEASE_ID}")"
TARGET_RELEASE_DIR="${RELEASES_DIR}/${RELEASE_ID}"
run "mkdir -p '${TARGET_RELEASE_DIR}'"
run "tar -xzf '${ARTIFACT_PATH}' -C '${TARGET_RELEASE_DIR}'"

if [[ -L "${CURRENT_LINK}" ]]; then
  run "rm -f '${PREVIOUS_LINK}'"
  run "ln -sfn '$(readlink "${CURRENT_LINK}")' '${PREVIOUS_LINK}'"
fi
run "ln -sfn '${TARGET_RELEASE_DIR}' '${CURRENT_LINK}'"

COMPOSE_CMD="docker compose --env-file '${ENV_FILE}' -f '${CURRENT_LINK}/docker-compose.yml'"

# deterministic sequence: infra -> migrate -> app restart -> health
run "${COMPOSE_CMD} up -d postgres redis"
run "${COMPOSE_CMD} run --rm api sh -lc 'cd apps/api && npx prisma migrate deploy --schema=prisma/schema.prisma'"
run "${COMPOSE_CMD} up -d --force-recreate api web"
run "sleep 3"
run "curl -fsS http://127.0.0.1:3001/api/health >/dev/null"
run "curl -fsS -I http://127.0.0.1:3000 >/dev/null"

if [[ "${DRY_RUN}" != "1" ]]; then
  echo "${RELEASE_ID}" > "${STATE_DIR}/last_successful_release"
fi

hook post_deploy

echo "Deployed release: ${RELEASE_ID}"
