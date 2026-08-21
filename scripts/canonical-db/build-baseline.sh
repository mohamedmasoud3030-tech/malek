#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

OUT_DIR="$ROOT_DIR/.canonical-db-output"
DIAG_DIR="$OUT_DIR/diagnostics"
BASELINE_NAME="20260901000000_canonical_baseline.sql"
BASELINE_PATH="$ROOT_DIR/supabase/migrations/$BASELINE_NAME"
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
  python3 - "$input" "$output" <<'PY'
import re, sys
src, dst = sys.argv[1], sys.argv[2]
skip = (
    "-- Dumped from database version",
    "-- Dumped by pg_dump version",
    "-- Started on ",
    "-- Completed on ",
)
out = []
for raw in open(src, encoding="utf-8", errors="replace"):
    line = raw.rstrip("\n")
    if line.startswith(skip) or line.startswith("\\restrict ") or line.startswith("\\unrestrict "):
        continue
    if line.startswith("GRANT ") or line.startswith("REVOKE ") or line.startswith("ALTER DEFAULT PRIVILEGES "):
        continue
    if "CHECK" in line or line.lstrip().startswith("CONSTRAINT"):
        line = re.sub(r"\s+", "", line)
        line = line.replace("(", "").replace(")", "")
    out.append(line.rstrip())
text = "\n".join(out)
text = re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"
open(dst, "w", encoding="utf-8").write(text)
PY
}

schema_dump() {
  local output="$1"
  pnpm exec supabase db dump --local --schema public,app_private -f "$output"
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

  # The lifecycle contract has three deliberate stages: seed deterministic
  # fixtures, exercise the real collect/VOID RPCs (same contract as the
  # browser), then inspect the resulting database state. Calling verify
  # directly after seed is invalid because no payment should exist yet.
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
  pnpm --filter ./rentrix-app exec node scripts/single-office-isolated-smoke.mjs lifecycle

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
  # Schema equality is a bootstrap contract. Capture it before the isolated
  # lifecycle writes demo rows; those RPCs must not be required to leave
  # GRANT/ACL fingerprints in pg_dump output.
  schema_dump "$dump_path"
  normalize_dump "$dump_path" "$normalized_path"
  run_runtime_seed_and_verify
  run_canonical_checks
}

# The historical pre-canonical chain was folded into the canonical baseline.
# This script now only verifies that the canonical layout rebuilds cleanly twice.
if [[ ! -f "$BASELINE_PATH" ]]; then
  echo "Canonical baseline missing: $BASELINE_PATH" >&2
  exit 1
fi

echo "Canonical active layout present; verifying two fresh rebuilds."
verify_rebuild "final-rebuild-1"
pnpm exec supabase stop --no-backup >/dev/null 2>&1 || true
verify_rebuild "final-rebuild-2"
diff -u "$OUT_DIR/final-rebuild-1.normalized.sql" "$OUT_DIR/final-rebuild-2.normalized.sql"
sha256sum "$OUT_DIR/final-rebuild-1.normalized.sql" "$OUT_DIR/final-rebuild-2.normalized.sql" \
  | tee "$OUT_DIR/final-schema-sha256.txt"
active_migrations="$(find "$ROOT_DIR/supabase/migrations" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
printf 'mode=verify-final\nactive_migrations=%s\nrebuild_1=PASS\nrebuild_2=PASS\nschema_diff=ZERO\n' "$active_migrations" \
  | tee "$OUT_DIR/result.env"
exit 0
