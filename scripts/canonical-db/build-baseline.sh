#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

OUT_DIR="$ROOT_DIR/.canonical-db-output"
DIAG_DIR="$OUT_DIR/diagnostics"
BASELINE_NAME="20260901000000_canonical_baseline.sql"
BASELINE_PATH="$ROOT_DIR/supabase/migrations/$BASELINE_NAME"
HISTORY_DIR="$ROOT_DIR/supabase/migrations_history"
REFERENCE_SEED="$ROOT_DIR/scripts/canonical-db/reference-seed.sql"
CANONICALIZE_SQL="$ROOT_DIR/scripts/canonical-db/canonicalize.sql"
VERIFY_SQL="$ROOT_DIR/scripts/canonical-db/verify-canonical.sql"
mkdir -p "$OUT_DIR" "$DIAG_DIR"

export SUPABASE_EXCLUDED_SERVICES="realtime,imgproxy,mailpit,studio,edge-runtime,logflare,vector,supavisor"

cleanup() {
  local status=$?
  trap - EXIT
  set +e
  pnpm exec supabase status --output json >"$DIAG_DIR/status-final.json" 2>&1
  pnpm exec supabase stop --no-backup >"$DIAG_DIR/stop-final.log" 2>&1
  exit "$status"
}
trap cleanup EXIT

start_fresh() {
  pnpm exec supabase stop --no-backup >/dev/null 2>&1 || true
  bash scripts/ci/start-supabase-stable.sh
}

read_db_url() {
  local status_file
  status_file="$(mktemp)"
  pnpm exec supabase status --output env >"$status_file"
  DB_URL="$(sed -n 's/^DB_URL=//p' "$status_file" | tr -d '"' | tail -n 1)"
  rm -f "$status_file"
  : "${DB_URL:?Supabase status did not report DB_URL}"
  export DB_URL
}

normalize_dump() {
  local input="$1"
  local output="$2"
  sed -E \
    -e '/^-- Dumped from database version/d' \
    -e '/^-- Dumped by pg_dump version/d' \
    -e '/^-- Started on /d' \
    -e '/^-- Completed on /d' \
    -e '/^\\restrict /d' \
    -e '/^\\unrestrict /d' \
    "$input" >"$output"
}

schema_dump() {
  local output="$1"
  pnpm exec supabase db dump --local --schema public,app_private -f "$output"
}

write_bootstrap_baseline() {
  local schema_sql="$1"
  local output="$2"
  cat >"$output" <<'SQL'
-- MALEK canonical database baseline.
-- Generated only after the historical chain passes the database suite and the
-- canonicalization transform passes its assertions on real local Supabase.
--
-- Supabase schema dumps do not reliably include extension installation when a
-- schema filter is used. These are application-required extensions used by the
-- canonical schema (UUID/crypto helpers, exclusion constraints, and citext
-- compatibility). Platform-managed extensions remain Supabase-owned.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists citext with schema extensions;

SQL
  cat "$schema_sql" >>"$output"
}

run_canonical_checks() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$VERIFY_SQL"

  local rls_off
  rls_off="$(psql "$DB_URL" -Atqc "
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity;
  ")"
  [[ "$rls_off" == "0" ]]

  psql "$DB_URL" -v ON_ERROR_STOP=1 -Atqc "
    select 1 where
      to_regprocedure('public.rpt_dashboard_snapshot(date,date,date)') is not null
      and to_regprocedure('public.post_journal_event(jsonb)') is not null
      and to_regprocedure('public.create_contract_atomic(text,uuid,uuid,uuid,date,date,numeric,text,uuid,text,text,text,text,integer,integer)') is not null;
  " | grep -qx '1'
}

run_reference_seed() {
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/supabase/seed.sql"
}

run_runtime_seed_and_verify() {
  local status_env api_url anon_key service_role_key
  status_env="$(mktemp)"
  pnpm exec supabase status --output env >"$status_env"
  api_url="$(sed -nE 's/^API_URL="?([^\"]*)"?$/\1/p' "$status_env" | tail -n 1)"
  [[ -n "$api_url" ]] || api_url="$(sed -nE 's/^SUPABASE_URL="?([^\"]*)"?$/\1/p' "$status_env" | tail -n 1)"
  anon_key="$(sed -nE 's/^ANON_KEY="?([^\"]*)"?$/\1/p' "$status_env" | tail -n 1)"
  [[ -n "$anon_key" ]] || anon_key="$(sed -nE 's/^SUPABASE_ANON_KEY="?([^\"]*)"?$/\1/p' "$status_env" | tail -n 1)"
  service_role_key="$(sed -nE 's/^SERVICE_ROLE_KEY="?([^\"]*)"?$/\1/p' "$status_env" | tail -n 1)"
  [[ -n "$service_role_key" ]] || service_role_key="$(sed -nE 's/^SUPABASE_SERVICE_ROLE_KEY="?([^\"]*)"?$/\1/p' "$status_env" | tail -n 1)"
  rm -f "$status_env"

  : "${api_url:?local Supabase API URL missing}"
  : "${anon_key:?local Supabase anon key missing}"
  : "${service_role_key:?local Supabase service role key missing}"

  # A canonical fresh database intentionally contains no default tenant/company
  # row. The isolated lifecycle fixture therefore bootstraps its own disposable
  # company before creating auth identities/memberships. This stays outside the
  # schema and reference seed and runs only on local/QA smoke environments.
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
insert into public.companies
  (id, name, slug, currency, locale, timezone, is_active)
values
  ('00000000-0000-4000-8000-000000000001'::uuid,
   'Canonical Isolated Smoke Company',
   'canonical-isolated-smoke',
   'OMR', 'ar-OM', 'Asia/Muscat', true)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  currency = excluded.currency,
  locale = excluded.locale,
  timezone = excluded.timezone,
  is_active = true,
  updated_at = now();
SQL

  E2E_ENVIRONMENT_KIND=local \
  E2E_SINGLE_OFFICE_EMAIL=canonical-admin@rentrix.test \
  E2E_SINGLE_OFFICE_PASSWORD='Canonical-Aa1!' \
  VITE_SUPABASE_URL="$api_url" \
  VITE_SUPABASE_ANON_KEY="$anon_key" \
  SUPABASE_SERVICE_ROLE_KEY="$service_role_key" \
  PRODUCTION_SUPABASE_PROJECT_REF=nnggcnpcuomwfuupupwg \
  SINGLE_OFFICE_EVIDENCE_PATH="$DIAG_DIR/canonical-seed.json" \
  pnpm --filter ./rentrix-app exec node scripts/single-office-isolated-smoke.mjs seed

  E2E_ENVIRONMENT_KIND=local \
  E2E_SINGLE_OFFICE_EMAIL=canonical-admin@rentrix.test \
  E2E_SINGLE_OFFICE_PASSWORD='Canonical-Aa1!' \
  VITE_SUPABASE_URL="$api_url" \
  VITE_SUPABASE_ANON_KEY="$anon_key" \
  SUPABASE_SERVICE_ROLE_KEY="$service_role_key" \
  PRODUCTION_SUPABASE_PROJECT_REF=nnggcnpcuomwfuupupwg \
  SINGLE_OFFICE_EVIDENCE_PATH="$DIAG_DIR/canonical-lifecycle.json" \
  pnpm --filter ./rentrix-app exec node scripts/single-office-isolated-smoke.mjs verify

  psql "$DB_URL" -v ON_ERROR_STOP=1 -Atqc "
    select count(*)
    from (
      select b.id
      from public.journal_batches b
      join public.journal_lines l on l.batch_id=b.id and l.deleted_at is null
      where upper(coalesce(b.status,''))='POSTED'
      group by b.id
      having round(coalesce(sum(l.debit),0),3) <> round(coalesce(sum(l.credit),0),3)
    ) q;
  " | grep -qx '0'
}

verify_rebuild() {
  local label="$1"
  local dump_path="$OUT_DIR/${label}.sql"
  local normalized_path="$OUT_DIR/${label}.normalized.sql"

  start_fresh
  read_db_url
  run_reference_seed
  run_canonical_checks
  run_runtime_seed_and_verify
  run_canonical_checks
  schema_dump "$dump_path"
  normalize_dump "$dump_path" "$normalized_path"
}

is_final_layout=false
if [[ -d "$HISTORY_DIR" ]] && [[ -f "$BASELINE_PATH" ]]; then
  migration_count="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
  if [[ "$migration_count" == "1" ]]; then
    is_final_layout=true
  fi
fi

if [[ "$is_final_layout" == "true" ]]; then
  echo "Canonical active layout already present; verifying two fresh rebuilds."
  verify_rebuild "final-rebuild-1"
  pnpm exec supabase stop --no-backup >/dev/null 2>&1 || true
  verify_rebuild "final-rebuild-2"
  diff -u "$OUT_DIR/final-rebuild-1.normalized.sql" "$OUT_DIR/final-rebuild-2.normalized.sql"
  sha256sum "$OUT_DIR/final-rebuild-1.normalized.sql" "$OUT_DIR/final-rebuild-2.normalized.sql" \
    | tee "$OUT_DIR/final-schema-sha256.txt"
  printf 'mode=verify-final\nactive_migrations=1\nrebuild_1=PASS\nrebuild_2=PASS\nschema_diff=ZERO\n' \
    | tee "$OUT_DIR/result.env"
  exit 0
fi

# ---------------------------------------------------------------------------
# Generation mode: prove the historical chain first, canonicalize only inside
# the ephemeral database, dump the reconciled end-state, then prove that dump
# can replace the entire active historical bootstrap.
# ---------------------------------------------------------------------------

echo "Generation mode: replay historical chain on real local Supabase."
start_fresh
read_db_url

pnpm exec supabase test db | tee "$DIAG_DIR/historical-supabase-test.log"

psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$CANONICALIZE_SQL" | tee "$DIAG_DIR/canonicalize.log"
run_canonical_checks

# Keep the pure canonical schema dump for equality comparison. The executable
# baseline adds only extension bootstrap statements ahead of this dump.
CANONICAL_SCHEMA_DUMP="$OUT_DIR/canonical-schema.sql"
schema_dump "$CANONICAL_SCHEMA_DUMP"
normalize_dump "$CANONICAL_SCHEMA_DUMP" "$OUT_DIR/generated-baseline.normalized.sql"

RAW_BASELINE="$OUT_DIR/$BASELINE_NAME"
write_bootstrap_baseline "$CANONICAL_SCHEMA_DUMP" "$RAW_BASELINE"

pnpm exec supabase stop --no-backup >/dev/null 2>&1 || true
mkdir -p "$HISTORY_DIR"
git mv supabase/migrations/*.sql "$HISTORY_DIR/"
cat >"$HISTORY_DIR/README.md" <<'EOF'
# Historical migration chain

These files are the pre-canonical MALEK migration history. They are retained as
searchable forensic evidence and MUST NOT be replayed for a fresh database.

The active bootstrap moved to `supabase/migrations/20260901000000_canonical_baseline.sql`
after a real-Supabase replay, evidence-based canonicalization, two fresh rebuilds
and schema-diff verification.

Future schema changes belong only in `supabase/migrations/` as new forward
migrations after the canonical baseline.
EOF

mkdir -p supabase/migrations
cp "$RAW_BASELINE" "$BASELINE_PATH"
cp "$REFERENCE_SEED" supabase/seed.sql

python - <<'PY'
from pathlib import Path
p = Path('supabase/config.toml')
s = p.read_text()
s = s.replace('[db.seed]\nenabled = false\nsql_paths = []',
              '[db.seed]\nenabled = true\nsql_paths = ["./seed.sql"]')
if '[db.seed]\nenabled = true\nsql_paths = ["./seed.sql"]' not in s:
    raise SystemExit('failed to enable deterministic seed in supabase/config.toml')
p.write_text(s)
PY

verify_rebuild "baseline-rebuild-1"
diff -u "$OUT_DIR/generated-baseline.normalized.sql" "$OUT_DIR/baseline-rebuild-1.normalized.sql"

pnpm exec supabase stop --no-backup >/dev/null 2>&1 || true
verify_rebuild "baseline-rebuild-2"
diff -u "$OUT_DIR/baseline-rebuild-1.normalized.sql" "$OUT_DIR/baseline-rebuild-2.normalized.sql"

sha256sum \
  "$OUT_DIR/generated-baseline.normalized.sql" \
  "$OUT_DIR/baseline-rebuild-1.normalized.sql" \
  "$OUT_DIR/baseline-rebuild-2.normalized.sql" \
  | tee "$OUT_DIR/schema-sha256.txt"

active_count="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
[[ "$active_count" == "1" ]]

printf 'mode=generate\nactive_migrations=1\nhistorical_chain_test=PASS\ncanonical_transform=PASS\nrebuild_1=PASS\nrebuild_2=PASS\nschema_diff=ZERO\n' \
  | tee "$OUT_DIR/result.env"
