#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="${CI_DIAGNOSTICS_DIR:-$ROOT_DIR/.ci-diagnostics/supabase}"
mkdir -p "$LOG_DIR"
STATUS_ENV_FILE=""

cleanup() {
  local status=$?
  trap - EXIT
  set +e
  if [[ -n "$STATUS_ENV_FILE" ]]; then rm -f "$STATUS_ENV_FILE"; fi
  pnpm exec supabase status --output json >"$LOG_DIR/supabase-status-final.json" 2>&1
  pnpm exec supabase stop --no-backup >>"$LOG_DIR/supabase-stop.log" 2>&1
  docker ps -a --filter 'name=supabase_' >"$LOG_DIR/docker-ps-final.log" 2>&1
  exit "$status"
}
trap cleanup EXIT

read_status_value() {
  local primary_name="$1"
  local fallback_name="${2:-}"
  local value

  value="$(sed -nE "s/^${primary_name}=\"?([^\"]*)\"?$/\1/p" "$STATUS_ENV_FILE" | tail -n 1)"
  if [[ -z "$value" && -n "$fallback_name" ]]; then
    value="$(sed -nE "s/^${fallback_name}=\"?([^\"]*)\"?$/\1/p" "$STATUS_ENV_FILE" | tail -n 1)"
  fi
  printf '%s' "$value"
}

# Wait for the HTTP services (Kong gateway, GoTrue, Storage API) to actually
# answer requests. `supabase start` returning 0 only means the containers were
# created; hitting the API immediately afterwards races their bootstrap.
wait_for_supabase_api() {
  local api_url="$1"
  local anon_key="$2"
  local deadline=$((SECONDS + 300))
  local auth_code storage_code

  while (( SECONDS < deadline )); do
    auth_code="$(curl -s -o /dev/null -w '%{http_code}' \
      -H "apikey: $anon_key" "$api_url/auth/v1/health" 2>/dev/null || printf '000')"
    storage_code="$(curl -s -o /dev/null -w '%{http_code}' \
      -H "apikey: $anon_key" "$api_url/storage/v1/status" 2>/dev/null || printf '000')"
    # Any answered HTTP status below 500 means the service is alive; 000 means
    # no TCP listener yet and 5xx means the gateway is still wiring up.
    if [[ "$auth_code" != "000" && "$auth_code" < "500" \
       && "$storage_code" != "000" && "$storage_code" < "500" ]]; then
      printf 'Supabase HTTP services are ready (auth=%s storage=%s).\n' \
        "$auth_code" "$storage_code" | tee "$LOG_DIR/supabase-api-ready.log"
      return 0
    fi
    sleep 2
  done

  printf 'Supabase HTTP services did not become ready in time (auth=%s storage=%s).\n' \
    "$auth_code" "$storage_code" | tee "$LOG_DIR/supabase-api-ready.log" >&2
  return 1
}

node scripts/ci/check-cron-quoting.mjs

# Single full-stack bring-up on a FRESH project volume. `supabase start`
# applies every migration under supabase/migrations to the empty database, so
# the migration chain is replayed exactly once with no `db reset`. This is a
# hard-earned constraint: `db reset` on CLI 2.105 restarts the service
# containers and health-checks them through Kong inside a ~12s window, which
# races the restarted Storage/GoTrue boot and fails with a 502. A second
# `supabase start --exclude ...` against an already-running project is not a
# substitute either — 2.105 reconciles to the first invocation's shape and
# stops the newly needed services. Excluded names below are valid for CLI
# 2.105 (mailpit, not inbucket); GoTrue/Kong/Storage/PostgREST stay up.
export SUPABASE_EXCLUDED_SERVICES="realtime,imgproxy,mailpit,studio,edge-runtime,logflare,vector,supavisor"
bash scripts/ci/start-supabase-stable.sh

set -o pipefail

# Belt-and-braces: prove the start-time replay covered every migration file,
# including the storage-hardening one this gate exists for. `migration up` is
# idempotent and, unlike `db reset`, does not restart any container.
if ! pnpm exec supabase migration list --local 2>/dev/null | grep -q '20260721090000'; then
  printf 'Migration list missed 20260721090000; applying pending migrations explicitly.\n' \
    | tee "$LOG_DIR/supabase-migration-up.log"
  pnpm exec supabase migration up --local 2>&1 | tee -a "$LOG_DIR/supabase-migration-up.log"
fi

# pgTAP runs on the exact ephemeral stack and owns every write-heavy release
# rehearsal: contracts, invoices, collections, VOID parity, deposits, owner
# settlements, idempotency, RLS, journals, balances, and security invariants.
pnpm exec supabase test db 2>&1 | tee "$LOG_DIR/supabase-test.log"

# FA-004 real two-transaction row-lock check on the same fresh replay.
bash scripts/ci/run-owner-agreement-concurrency-test.sh 2>&1 | tee "$LOG_DIR/owner-agreement-concurrency.log"

# The Storage API smoke runs on the same isolated local stack. This tests the
# real Auth + Storage HTTP path without using production or any paid Staging.
STATUS_ENV_FILE="$(mktemp)"
pnpm exec supabase status --output env >"$STATUS_ENV_FILE" 2>"$LOG_DIR/supabase-status-env.stderr.log"
sed -nE 's/^([A-Z0-9_]+)=.*/\1/p' "$STATUS_ENV_FILE" \
  | sort -u >"$LOG_DIR/supabase-status-env-keys.log"

API_URL="$(read_status_value API_URL SUPABASE_URL)"
ANON_KEY="$(read_status_value ANON_KEY SUPABASE_ANON_KEY)"
SERVICE_ROLE_KEY="$(read_status_value SERVICE_ROLE_KEY SUPABASE_SERVICE_ROLE_KEY)"

: "${API_URL:?Supabase local API URL was not reported; inspect supabase-status-env-keys.log}"
: "${ANON_KEY:?Supabase local anonymous key was not reported; inspect supabase-status-env-keys.log}"
: "${SERVICE_ROLE_KEY:?Supabase local service-role key was not reported; inspect supabase-status-env-keys.log}"

wait_for_supabase_api "$API_URL" "$ANON_KEY"

rm -f "$STATUS_ENV_FILE"
STATUS_ENV_FILE=""

E2E_ENVIRONMENT_KIND=local \
VITE_SUPABASE_URL="$API_URL" \
VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
PRODUCTION_SUPABASE_PROJECT_REF=nnggcnpcuomwfuupupwg \
pnpm --filter ./rentrix-app exec node scripts/storage-isolated-smoke.mjs \
  2>&1 | tee "$LOG_DIR/storage-isolated-smoke.log"

E2E_ENVIRONMENT_KIND=local \
E2E_SINGLE_OFFICE_EMAIL=single-office-admin@rentrix.test \
E2E_SINGLE_OFFICE_PASSWORD='SingleOffice-Aa1!' \
VITE_SUPABASE_URL="$API_URL" \
VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
PRODUCTION_SUPABASE_PROJECT_REF=nnggcnpcuomwfuupupwg \
SINGLE_OFFICE_EVIDENCE_PATH="$LOG_DIR/single-office-seed.json" \
pnpm --filter ./rentrix-app exec node scripts/single-office-isolated-smoke.mjs seed \
  2>&1 | tee "$LOG_DIR/single-office-seed.log"

E2E_ENVIRONMENT_KIND=local \
E2E_SINGLE_OFFICE_ENABLED=1 \
E2E_SINGLE_OFFICE_EMAIL=single-office-admin@rentrix.test \
E2E_SINGLE_OFFICE_PASSWORD='SingleOffice-Aa1!' \
VITE_SUPABASE_URL="$API_URL" \
VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
pnpm --filter ./rentrix-app exec playwright test e2e/single-office-isolated.spec.ts \
  --config playwright.config.ts \
  2>&1 | tee "$LOG_DIR/single-office-browser.log"

E2E_ENVIRONMENT_KIND=local \
E2E_SINGLE_OFFICE_EMAIL=single-office-admin@rentrix.test \
E2E_SINGLE_OFFICE_PASSWORD='SingleOffice-Aa1!' \
VITE_SUPABASE_URL="$API_URL" \
VITE_SUPABASE_ANON_KEY="$ANON_KEY" \
SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
PRODUCTION_SUPABASE_PROJECT_REF=nnggcnpcuomwfuupupwg \
SINGLE_OFFICE_EVIDENCE_PATH="$LOG_DIR/single-office-lifecycle.json" \
pnpm --filter ./rentrix-app exec node scripts/single-office-isolated-smoke.mjs verify \
  2>&1 | tee "$LOG_DIR/single-office-verify.log"

printf 'Ephemeral migration replay, authenticated single-office browser lifecycle, RLS/accounting invariants, and isolated Storage smoke completed successfully.\n'
