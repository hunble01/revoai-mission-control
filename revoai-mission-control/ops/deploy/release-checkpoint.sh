#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="${ROOT_DIR}/.deploy"
mkdir -p "${STATE_DIR}"

VERSION="${1:-$(date -u +%Y.%m.%d-%H%M)}"
TAG="release-${VERSION}"
COMMIT="$(git -C "${ROOT_DIR}" rev-parse --short HEAD)"
DATE_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if git -C "${ROOT_DIR}" rev-parse "${TAG}" >/dev/null 2>&1; then
  echo "Tag already exists: ${TAG}"
  exit 1
fi

git -C "${ROOT_DIR}" tag -a "${TAG}" -m "Release checkpoint ${TAG} (${COMMIT})"

CHANGELOG="${ROOT_DIR}/docs/CHANGELOG.md"
if [[ ! -f "${CHANGELOG}" ]]; then
  cat > "${CHANGELOG}" <<'EOF'
# Changelog

EOF
fi

TMP_FILE="${STATE_DIR}/.changelog.tmp"
{
  echo "# Changelog"
  echo
  echo "## ${TAG} - ${DATE_UTC}"
  echo "- Release checkpoint created at commit ${COMMIT}."
  echo
  tail -n +2 "${CHANGELOG}" 2>/dev/null || true
} > "${TMP_FILE}"
mv "${TMP_FILE}" "${CHANGELOG}"

echo "${TAG}"
