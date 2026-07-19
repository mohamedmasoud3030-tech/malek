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

# The Storage API smoke must run after every migration and pgTAP assertion on
# the same isolated local stack. This tests the real Auth + Storage HTTP path
# without using production or relying on mislabeled external Staging secrets.
eval "$(pnpm exec supabase status --output env)"
: "${API_URL:?Supabase local API_URL was not reported}"
: "${ANON_KEY:?Supabase local ANON_KEY was not reported}"
: "${SERVICE_ROLE_KEY:?Supabase local SERVICE_ROLE_KEY was not reported}"

E2E_ENVIRONMENT_KIND=local \
VITE_SUPABASE_URL="$API_URL" \
VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
PRODUCTION_SUPABASE_PROJECT_REF=nnggcnpcuomwfuupupwg \
pnpm --filter ./rentrix-app exec node scripts/storage-isolated-smoke.mjs \
  2>&1 | tee "$LOG_DIR/storage-isolated-smoke.log"

printf 'Empty database replay, database/RLS tests, and isolated Storage API smoke completed successfully.\n'
