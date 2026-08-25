#!/usr/bin/env bash
# Detects drift between the repository's migration file manifest and the
# live supabase_migrations.schema_migrations ledger.
#
# Background: a Phase 3 Operational Release Proof pass (2026-08-25) found
# that 16 migrations present in supabase/migrations/ were NOT recorded in
# the live project's schema_migrations table, even though their effects
# (constraints, triggers, function bodies, column types) were verifiably
# present in the live schema. This means the migrations were applied by
# hand at some point without the ledger being updated — a real rollback/
# disaster-recovery risk, since anyone rebuilding production from the
# tracked ledger alone would get a different, less-hardened schema than
# what is actually running.
#
# This script does not attempt to fix that drift (see
# docs/operations/BACKUP_RESTORE_RUNBOOK.md for the documented, reversible
# repair procedure using `supabase migration repair`). It only detects and
# reports it, so it shows up as a visible, tracked CI failure instead of
# silently persisting.
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "Migration ledger parity check skipped: SUPABASE_DB_URL is not set." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Migration ledger parity check skipped: psql is not installed." >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest_file="$(mktemp)"
ledger_file="$(mktemp)"
trap 'rm -f "$manifest_file" "$ledger_file"' EXIT

find "$repo_root/supabase/migrations" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' \
  | grep -E '^[0-9]{14}_' \
  | cut -d_ -f1 \
  | sort -u > "$manifest_file"

psql "$SUPABASE_DB_URL" \
  --set=ON_ERROR_STOP=1 \
  --set=VERBOSITY=terse \
  --no-align \
  --tuples-only \
  --command "select version from supabase_migrations.schema_migrations order by version;" \
  | sort -u > "$ledger_file"

missing_from_ledger="$(comm -23 "$manifest_file" "$ledger_file")"
missing_from_repo="$(comm -13 "$manifest_file" "$ledger_file")"

status=0

if [[ -n "$missing_from_ledger" ]]; then
  echo "DRIFT DETECTED: repository migrations not recorded in the live ledger:" >&2
  echo "$missing_from_ledger" >&2
  echo "" >&2
  echo "This does not necessarily mean the migration effects are missing live —" >&2
  echo "verify by inspecting the actual schema objects before assuming data loss." >&2
  echo "See docs/operations/BACKUP_RESTORE_RUNBOOK.md for the verified repair path." >&2
  status=1
fi

if [[ -n "$missing_from_repo" ]]; then
  echo "DRIFT DETECTED: ledger has versions with no matching repository file:" >&2
  echo "$missing_from_repo" >&2
  status=1
fi

if [[ "$status" -eq 0 ]]; then
  echo "migration_ledger_parity=OK ($(wc -l < "$manifest_file") migrations, repo and live ledger match)"
fi

exit "$status"
