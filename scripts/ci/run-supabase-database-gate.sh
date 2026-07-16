#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="${CI_DIAGNOSTICS_DIR:-$ROOT_DIR/.ci-diagnostics/supabase}"
mkdir -p "$LOG_DIR"

cleanup() {
  local status=$?
  trap - EXIT
  set +e
  pnpm exec supabase status --output json >"$LOG_DIR/supabase-status-final.json" 2>&1
  pnpm exec supabase stop --no-backup >>"$LOG_DIR/supabase-stop.log" 2>&1
  docker ps -a --filter 'name=supabase_' >"$LOG_DIR/docker-ps-final.log" 2>&1
  exit "$status"
}
trap cleanup EXIT

node scripts/ci/check-cron-quoting.mjs
bash scripts/ci/start-supabase-stable.sh

set -o pipefail
pnpm exec supabase db reset --local 2>&1 | tee "$LOG_DIR/supabase-reset.log"
pnpm exec supabase test db 2>&1 | tee "$LOG_DIR/supabase-test.log"

printf 'Empty database replay and database/RLS tests completed successfully.\n'
