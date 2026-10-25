#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_DIR="${ROOT_DIR}/.deploy"
RECORDS_FILE="${STATE_DIR}/deploy-records.jsonl"
mkdir -p "${STATE_DIR}"

ACTION="${1:-deploy}"
RELEASE_ID="${2:-unknown}"
STATUS="${3:-ok}"
NOTES="${4:-}"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

cat >> "${RECORDS_FILE}" <<EOF
{"ts":"${TIMESTAMP}","action":"${ACTION}","release":"${RELEASE_ID}","status":"${STATUS}","notes":"${NOTES}"}
EOF

echo "recorded:${ACTION}:${RELEASE_ID}:${STATUS}"
