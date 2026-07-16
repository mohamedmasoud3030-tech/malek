#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="${CI_DIAGNOSTICS_DIR:-$ROOT_DIR/.ci-diagnostics/supabase}"
mkdir -p "$LOG_DIR"
START_LOG="$LOG_DIR/supabase-start.log"
: > "$START_LOG"

EXPECTED_VERSION="${SUPABASE_CLI_VERSION:-2.105.0}"
ACTUAL_VERSION="$(pnpm exec supabase --version | tr -d '\r' | tail -n 1 | xargs)"
if [[ "$ACTUAL_VERSION" != "$EXPECTED_VERSION" ]]; then
  printf 'Expected Supabase CLI %s, got %s\n' "$EXPECTED_VERSION" "$ACTUAL_VERSION" | tee -a "$START_LOG" >&2
  exit 1
fi

EXCLUDED_SERVICES="${SUPABASE_EXCLUDED_SERVICES:-gotrue,realtime,storage-api,imgproxy,kong,inbucket,postgrest,studio,edge-runtime,logflare,vector,supavisor}"
MAX_ATTEMPTS="${SUPABASE_START_ATTEMPTS:-3}"

stop_stack() {
  pnpm exec supabase stop --no-backup >>"$START_LOG" 2>&1 || true
}

is_transient_failure() {
  local log_file="$1"
  grep -Eiq \
    'toomanyrequests|rate exceeded|too many requests|(^|[^0-9])429([^0-9]|$)|tls handshake timeout|i/o timeout|connection reset|unexpected eof|context deadline exceeded|temporary failure|network is unreachable|no such host' \
    "$log_file"
}

wait_for_database() {
  local container_name=""
  for _ in $(seq 1 60); do
    container_name="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
    if [[ -n "$container_name" ]] && docker exec "$container_name" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
      printf 'Supabase PostgreSQL is healthy in container %s\n' "$container_name" | tee -a "$START_LOG"
      return 0
    fi
    sleep 2
  done

  printf 'Supabase PostgreSQL health check timed out.\n' | tee -a "$START_LOG" >&2
  docker ps -a --filter 'name=supabase_' >>"$START_LOG" 2>&1 || true
  if [[ -n "$container_name" ]]; then
    docker logs "$container_name" >>"$LOG_DIR/postgres-container.log" 2>&1 || true
  fi
  return 1
}

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  attempt_log="$LOG_DIR/supabase-start-attempt-${attempt}.log"
  : > "$attempt_log"
  stop_stack

  printf 'Starting isolated Supabase database (attempt %s/%s).\n' "$attempt" "$MAX_ATTEMPTS" | tee -a "$START_LOG"
  set +e
  pnpm exec supabase start --exclude "$EXCLUDED_SERVICES" \
    > >(tee "$attempt_log") \
    2> >(tee -a "$attempt_log" >&2)
  start_status=$?
  set -e
  cat "$attempt_log" >>"$START_LOG"

  if [[ "$start_status" -eq 0 ]] && wait_for_database; then
    exit 0
  fi

  if ! is_transient_failure "$attempt_log"; then
    printf 'Supabase start failed with a non-transient error; retry is intentionally disabled.\n' | tee -a "$START_LOG" >&2
    exit "${start_status:-1}"
  fi

  if [[ "$attempt" -lt "$MAX_ATTEMPTS" ]]; then
    backoff=$((attempt * 20))
    printf 'Transient container/network failure detected; retrying after %ss.\n' "$backoff" | tee -a "$START_LOG"
    sleep "$backoff"
  fi
done

printf 'Supabase failed to start after %s transient retries.\n' "$MAX_ATTEMPTS" | tee -a "$START_LOG" >&2
exit 1
