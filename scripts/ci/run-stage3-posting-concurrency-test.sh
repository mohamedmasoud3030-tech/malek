#!/usr/bin/env bash
set -Eeuo pipefail

# S03-T09 — real PostgreSQL two-session idempotency proof.
#
# T1 posts one canonical event inside an explicit transaction and deliberately
# keeps the transaction/advisory lock open for five seconds. T2 starts one
# second later with the exact same event identity and financial content. It must
# block, then return the already-posted batch idempotently after T1 commits.
# The database must contain exactly one canonical batch and two lines.
#
# The proof rows intentionally remain in the ephemeral CI database until the
# outer Supabase gate tears the stack down. Posted financial history is immutable
# by design, so this script never weakens production triggers merely to clean up.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

STATUS_ENV="$(mktemp)"
T1_LOG="$(mktemp)"
T2_LOG="$(mktemp)"
cleanup() {
  rm -f "$STATUS_ENV" "$T1_LOG" "$T2_LOG"
}
trap cleanup EXIT

pnpm exec supabase status --output env >"$STATUS_ENV"
DB_URL="$(sed -n 's/^DB_URL=//p' "$STATUS_ENV" | tr -d '"' | tail -n 1)"
: "${DB_URL:?DB_URL was not reported by Supabase status}"

COMPANY_ID='00000000-0000-4000-8000-0000000000d3'
PERIOD_ID='00000000-0000-4000-8000-00000000d301'
SOURCE_ID='s03-concurrency-source'
EVENT_ID='s03-concurrency-event'

psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<SQL
insert into public.companies (id, name, slug)
values ('$COMPANY_ID', 'S03 Posting Concurrency Company', 's03-posting-concurrency')
on conflict (id) do nothing;

select public.provision_company_chart_of_accounts('$COMPANY_ID'::uuid);

insert into public.accounting_periods (
  id, company_id, name, start_date, end_date, status, created_at, updated_at
) values (
  '$PERIOD_ID', '$COMPANY_ID', '2026-08', date '2026-08-01', date '2026-08-31', 'OPEN', now(), now()
)
on conflict (id) do nothing;
SQL

POST_SQL=$(cat <<SQL
select public.post_journal_event(jsonb_build_object(
  'company_id', '$COMPANY_ID',
  'source_type', 's03_concurrency',
  'source_id', '$SOURCE_ID',
  'event_id', '$EVENT_ID',
  'effective_date', '2026-08-07',
  'description', 'S03 real two-session idempotency proof',
  'lines', jsonb_build_array(
    jsonb_build_object(
      'account_id', (select id from public.accounts where company_id='$COMPANY_ID'::uuid and no='1111'),
      'debit', 12.345,
      'credit', 0,
      'ref_source_id', '$SOURCE_ID'
    ),
    jsonb_build_object(
      'account_id', (select id from public.accounts where company_id='$COMPANY_ID'::uuid and no='6100'),
      'debit', 0,
      'credit', 12.345,
      'ref_source_id', '$SOURCE_ID'
    )
  )
));
SQL
)

# First connection owns the event advisory lock until COMMIT.
(
  psql "$DB_URL" -v ON_ERROR_STOP=1 -Atq -v VERBOSITY=terse >"$T1_LOG" 2>&1 <<SQL
begin;
$POST_SQL
select pg_sleep(5);
commit;
SQL
) &
T1_PID=$!

sleep 1

# Second connection must wait for T1's transaction-scoped advisory lock, then
# observe the committed batch and return the idempotent retry response.
START_NS="$(date +%s%N)"
psql "$DB_URL" -v ON_ERROR_STOP=1 -Atq -v VERBOSITY=terse >"$T2_LOG" 2>&1 <<SQL
begin;
$POST_SQL
commit;
SQL
END_NS="$(date +%s%N)"
wait "$T1_PID"
ELAPSED_MS=$(( (END_NS - START_NS) / 1000000 ))

if (( ELAPSED_MS < 3500 )); then
  echo "S03 posting concurrency failure: retry did not wait for the event lock (${ELAPSED_MS}ms)." >&2
  echo "--- T1 ---" >&2
  cat "$T1_LOG" >&2
  echo "--- T2 ---" >&2
  cat "$T2_LOG" >&2
  exit 1
fi

if ! grep -Eq '"idempotent"[[:space:]]*:[[:space:]]*true' "$T2_LOG"; then
  echo 'S03 posting concurrency failure: T2 did not return idempotent=true.' >&2
  cat "$T2_LOG" >&2
  exit 1
fi

read -r BATCH_COUNT LINE_COUNT STATUS_OK LEGACY_FLAG <<<"$(
  psql "$DB_URL" -AtF' ' -v ON_ERROR_STOP=1 -c "
    select
      count(distinct b.id)::int,
      count(l.id)::int,
      bool_and(b.status = 'POSTED'),
      bool_or(b.is_legacy_compat)
    from public.journal_batches b
    left join public.journal_lines l on l.batch_id = b.id and l.deleted_at is null
    where b.company_id = '$COMPANY_ID'::uuid
      and b.source_type = 's03_concurrency'
      and b.source_id = '$SOURCE_ID'
      and b.event_id = '$EVENT_ID';
  "
)"

if [[ "$BATCH_COUNT" != "1" || "$LINE_COUNT" != "2" || "$STATUS_OK" != "t" || "$LEGACY_FLAG" != "f" ]]; then
  echo "S03 posting concurrency failure: batch_count=$BATCH_COUNT line_count=$LINE_COUNT status_ok=$STATUS_OK legacy=$LEGACY_FLAG" >&2
  cat "$T1_LOG" "$T2_LOG" >&2
  exit 1
fi

printf 'S03 posting concurrency passed: retry waited %sms; one canonical POSTED batch / two lines / idempotent retry.\n' "$ELAPSED_MS"
