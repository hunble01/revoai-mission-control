#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ARTIFACTS_DIR="${ROOT_DIR}/artifacts/releases"
RELEASE_ID="${1:-$(date -u +%Y%m%d%H%M%S)-$(git -C "${ROOT_DIR}" rev-parse --short HEAD)}"
ARTIFACT_PATH="${ARTIFACTS_DIR}/revoai-mission-control-${RELEASE_ID}.tar.gz"

mkdir -p "${ARTIFACTS_DIR}"

git -C "${ROOT_DIR}" archive --format=tar.gz -o "${ARTIFACT_PATH}" HEAD

echo "${ARTIFACT_PATH}"
