#!/usr/bin/env bash
set -euo pipefail

DIST_DIR="${1:-rentrix-app/dist}"

if [[ ! -d "$DIST_DIR" ]]; then
  echo "BLOCKED: build output directory does not exist: $DIST_DIR" >&2
  exit 1
fi

patterns=(
  'SUPABASE_SERVICE_ROLE_KEY'
  'sb_secret_'
  '"role":"service_role"'
  'BEGIN PRIVATE KEY'
  'OPENAI_API_KEY'
  'sk-proj-'
)

status=0
for pattern in "${patterns[@]}"; do
  if grep -RIl --binary-files=without-match -- "$pattern" "$DIST_DIR" >/tmp/rentrix-secret-scan-files.txt; then
    echo "BLOCKED: forbidden secret/service-role marker found in browser build: $pattern" >&2
    cat /tmp/rentrix-secret-scan-files.txt >&2
    status=1
  fi
done

rm -f /tmp/rentrix-secret-scan-files.txt

if [[ "$status" -ne 0 ]]; then
  exit "$status"
fi

echo "Browser build secret scan passed."
