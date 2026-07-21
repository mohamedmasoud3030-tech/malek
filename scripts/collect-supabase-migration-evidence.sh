#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"

TARGET_REF="${SUPABASE_PROJECT_REF:-}"
if [[ -z "$TARGET_REF" && "${VITE_SUPABASE_URL:-}" =~ ^https://([a-z0-9]+)\.supabase\.co/?$ ]]; then
  TARGET_REF="${BASH_REMATCH[1]}"
fi

printf 'Rentrix Supabase migration evidence preflight\n'
printf 'Repository: %s\n' "$ROOT_DIR"
printf 'Timestamp UTC: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
printf '\n'

printf 'Local migration chain\n'
if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  printf 'Status: BLOCKED - missing supabase/migrations directory\n'
  exit 1
fi

mapfile -t migration_files < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort)
printf 'Migration count: %s\n' "${#migration_files[@]}"

if (( ${#migration_files[@]} == 0 )); then
  printf 'Status: BLOCKED - no local migration files found\n'
  exit 1
fi

previous_version=''
duplicate_versions=0
non_monotonic_versions=0
for file in "${migration_files[@]}"; do
  version="${file%%_*}"
  if [[ ! "$version" =~ ^[0-9]{14}$ ]]; then
    printf 'Invalid migration filename timestamp: %s\n' "$file"
    non_monotonic_versions=$((non_monotonic_versions + 1))
    continue
  fi

  if [[ "$version" == "$previous_version" ]]; then
    printf 'Duplicate migration timestamp: %s\n' "$version"
    duplicate_versions=$((duplicate_versions + 1))
  elif [[ -n "$previous_version" && "$version" < "$previous_version" ]]; then
    printf 'Non-monotonic migration timestamp: %s after %s\n' "$version" "$previous_version"
    non_monotonic_versions=$((non_monotonic_versions + 1))
  fi
  previous_version="$version"
done

printf 'First migration: %s\n' "${migration_files[0]}"
printf 'Last migration: %s\n' "${migration_files[-1]}"
printf 'Duplicate timestamp findings: %s\n' "$duplicate_versions"
printf 'Ordering findings: %s\n' "$non_monotonic_versions"
printf 'Local migration versions:\n'
printf '  %s\n' "${migration_files[@]%.sql}"
printf '\n'

printf 'Environment access summary\n'
if [[ -n "$TARGET_REF" ]]; then
  printf 'Candidate project ref: %s\n' "$TARGET_REF"
else
  printf 'Candidate project ref: BLOCKED - set SUPABASE_PROJECT_REF or VITE_SUPABASE_URL\n'
fi

if [[ -n "${VITE_SUPABASE_URL:-}" ]]; then
  printf 'VITE_SUPABASE_URL: present\n'
else
  printf 'VITE_SUPABASE_URL: missing\n'
fi

if [[ -n "${VITE_SUPABASE_ANON_KEY:-}" ]]; then
  printf 'VITE_SUPABASE_ANON_KEY: present (value redacted)\n'
else
  printf 'VITE_SUPABASE_ANON_KEY: missing\n'
fi

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  printf 'SUPABASE_ACCESS_TOKEN: present (value redacted)\n'
else
  printf 'SUPABASE_ACCESS_TOKEN: missing\n'
fi

if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  printf 'SUPABASE_DB_URL: present (value redacted)\n'
else
  printf 'SUPABASE_DB_URL: missing\n'
fi

if command -v supabase >/dev/null 2>&1; then
  printf 'Supabase CLI: %s\n' "$(supabase --version)"
else
  printf 'Supabase CLI: missing\n'
fi
printf '\n'

printf 'Live migration-state reconciliation\n'
if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
  if ! command -v psql >/dev/null 2>&1; then
    printf 'Status: BLOCKED - SUPABASE_DB_URL is present but psql is unavailable\n'
    printf 'Operation: read-only supabase_migrations.schema_migrations reconciliation\n'
    printf 'Category: unsupported\n'
    printf 'Repeated call: no\n'
    printf 'Next action: install psql in the operator environment or unset SUPABASE_DB_URL for preflight-only mode\n'
    exit 0
  fi

  live_tmp="$(mktemp)"
  local_tmp="$(mktemp)"
  missing_tmp="$(mktemp)"
  cleanup_live_reconciliation() {
    rm -f "$live_tmp" "$local_tmp" "$missing_tmp"
  }
  trap cleanup_live_reconciliation EXIT

  printf '%s\n' "${migration_files[@]%.sql}" > "$local_tmp"

  if ! psql "$SUPABASE_DB_URL" -X -A -t -c "select version || '_' || name from supabase_migrations.schema_migrations order by version, name" > "$live_tmp"; then
    printf 'Status: BLOCKED - failed to read supabase_migrations.schema_migrations\n'
    printf 'Operation: read-only supabase_migrations.schema_migrations reconciliation\n'
    printf 'Category: database_access\n'
    printf 'Repeated call: no\n'
    printf 'Next action: verify SUPABASE_DB_URL allows read-only access to the migration ledger\n'
    exit 0
  fi

  remote_only_tmp="$(mktemp)"
  local_only_tmp="$(mktemp)"
  trap 'rm -f "$live_tmp" "$local_tmp" "$missing_tmp" "$remote_only_tmp" "$local_only_tmp"' EXIT

  comm -23 "$local_tmp" "$live_tmp" > "$local_only_tmp"
  comm -13 "$local_tmp" "$live_tmp" > "$remote_only_tmp"
  local_only_count="$(wc -l < "$local_only_tmp" | tr -d ' ')"
  remote_only_count="$(wc -l < "$remote_only_tmp" | tr -d ' ')"
  printf 'Operation: read-only supabase_migrations.schema_migrations reconciliation\n'
  printf 'Live migration ledger entries read: %s\n' "$(wc -l < "$live_tmp" | tr -d ' ')"
  printf 'Local migration entries read: %s\n' "$(wc -l < "$local_tmp" | tr -d ' ')"
  printf 'Local-only migrations absent from live ledger: %s\n' "$local_only_count"
  printf 'Remote-only ledger entries absent from local migrations: %s\n' "$remote_only_count"

  if [[ "$local_only_count" != "0" ]]; then
    sed 's/^/Local-only migration: /' "$local_only_tmp"
  fi

  if [[ "$remote_only_count" != "0" ]]; then
    sed 's/^/Remote-only ledger entry: /' "$remote_only_tmp"
  fi

  if [[ "$local_only_count" != "0" || "$remote_only_count" != "0" ]]; then
    printf 'Status: FAILED - local and live migration ledgers differ\n'
    printf 'Failure reason: migration drift detected by read-only comparison; do not run repair or push automatically\n'
    exit 1
  fi

  printf 'Status: PASS - local migrations and live ledger match exactly\n'
  exit 0
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  printf 'Status: BLOCKED - authenticated Supabase access token is unavailable\n'
  printf 'Operation: read-only migration history and branch failure-state lookup\n'
  printf 'Category: authentication\n'
  printf 'Repeated call: no\n'
  printf 'Next action: provide approved read-only Supabase management/database access for the intended project ref\n'
  exit 0
fi

if ! command -v supabase >/dev/null 2>&1; then
  printf 'Status: BLOCKED - Supabase CLI is unavailable\n'
  printf 'Operation: read-only migration history and branch failure-state lookup\n'
  printf 'Category: unsupported\n'
  printf 'Repeated call: no\n'
  printf 'Next action: install the Supabase CLI in the operator environment or use an approved connector with equivalent read-only catalog access\n'
  exit 0
fi

printf 'Status: READY - authenticated CLI appears available\n'
printf 'Next action: run approved read-only Supabase migration/branch inspection commands from the secure operator runbook; do not mutate production.\n'
