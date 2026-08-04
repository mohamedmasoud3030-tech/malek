#!/usr/bin/env bash
set -Eeuo pipefail

# FA-003 real PostgreSQL concurrency check.
#
# Two parallel transactions both call create_owner_settlement_draft_atomic for
# the SAME owner / property / period. The advisory lock + partial unique index
# must let exactly ONE transaction reserve the items; the other must fail with
# SETTLEMENT_INPUT_ALREADY_RESERVED (or the active-period guard). Afterwards:
#   * exactly one settlement exists for that target;
#   * each payment appears in exactly ONE active (released_at IS NULL) link.
# No partial settlement, no orphan link, no doubled amounts.
#
# Mirrors scripts/ci/run-owner-agreement-concurrency-test.sh (FA-004).
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

STATUS_ENV="$(mktemp)"
T1_LOG="$(mktemp)"
T2_LOG="$(mktemp)"
cleanup() {
  set +e
  [[ -n "${DB_URL:-}" ]] && psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
    delete from public.owner_settlement_payment_links
      where settlement_id in ('00000000-0000-0000-0000-00000000s201','00000000-0000-0000-0000-00000000s202');
    delete from public.owner_settlement_expense_links
      where settlement_id in ('00000000-0000-0000-0000-00000000s201','00000000-0000-0000-0000-00000000s202');
    delete from public.owner_settlements where id in ('00000000-0000-0000-0000-00000000s201','00000000-0000-0000-0000-00000000s202');
    delete from public.expenses where id = '00000000-0000-0000-0000-00000000e201';
    delete from public.payments where id = '00000000-0000-0000-0000-00000000p201';
    delete from public.receipts where id = '00000000-0000-0000-0000-00000000p201';
    delete from public.invoices where id = '00000000-0000-0000-0000-00000000i201';
    delete from public.contracts where id = '00000000-0000-0000-0000-00000000t201';
    delete from public.units where id = '00000000-0000-0000-0000-00000000u201';
    delete from public.people where id = '00000000-0000-0000-0000-00000000pe201';
    delete from public.owner_agreements where id = '00000000-0000-0000-0000-00000000a201';
    delete from public.property_owners where id = '00000000-0000-0000-0000-00000000pw201';
    delete from public.properties where id = '00000000-0000-0000-0000-00000000pr201';
    delete from public.owners where id = '00000000-0000-0000-0000-00000000o201';
    delete from public.company_members where company_id = '00000000-0000-4000-8000-0000000000f3';
    delete from public.companies where id = '00000000-0000-4000-8000-0000000000f3';
    delete from public.users where id in ('00000000-0000-0000-0000-00000000f301','00000000-0000-0000-0000-00000000f302');
    delete from auth.users where id in ('00000000-0000-0000-0000-00000000f301','00000000-0000-0000-0000-00000000f302');
SQL
  rm -f "$STATUS_ENV" "$T1_LOG" "$T2_LOG"
}
trap cleanup EXIT

pnpm exec supabase status --output env >"$STATUS_ENV"
DB_URL="$(sed -n 's/^DB_URL=//p' "$STATUS_ENV" | tr -d '"' | tail -n 1)"
: "${DB_URL:?DB_URL was not reported by Supabase status}"

psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
insert into public.companies (id, name, slug) values ('00000000-0000-4000-8000-0000000000f3','FA3 Concurrency','fa3-concurrency') on conflict (id) do nothing;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000f301','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fa3-c1@test.invalid','not-used',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-00000000f302','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fa3-c2@test.invalid','not-used',now(),now(),now(),'{}','{}')
 on conflict (id) do nothing;
insert into public.users (id,email,name,role,status,is_active) values
 ('00000000-0000-0000-0000-00000000f301','fa3-c1@test.invalid','FA3 C1','ADMIN','ACTIVE',true),
 ('00000000-0000-0000-0000-00000000f302','fa3-c2@test.invalid','FA3 C2','ADMIN','ACTIVE',true)
 on conflict (id) do update set role='ADMIN',status='ACTIVE',is_active=true;
insert into public.company_members (company_id,user_id,role) values
 ('00000000-0000-4000-8000-0000000000f3','00000000-0000-0000-0000-00000000f301','ADMIN'),
 ('00000000-0000-4000-8000-0000000000f3','00000000-0000-0000-0000-00000000f302','ADMIN')
 on conflict (company_id,user_id) do update set role='ADMIN';
insert into public.owners (id,full_name,company_id) values ('00000000-0000-0000-0000-00000000o201','FA3 Owner','00000000-0000-4000-8000-0000000000f3');
insert into public.properties (id,title,type,address,status,company_id) values ('00000000-0000-0000-0000-00000000pr201','FA3 Prop','residential','FA3','active','00000000-0000-4000-8000-0000000000f3');
insert into public.property_owners (id,property_id,owner_id,ownership_percentage,is_primary,starts_on,ends_on,company_id) values
 ('00000000-0000-0000-0000-00000000pw201','00000000-0000-0000-0000-00000000pr201','00000000-0000-0000-0000-00000000o201',100,true,'2026-01-01','2027-12-31','00000000-0000-4000-8000-0000000000f3');
insert into public.owner_agreements (id,owner_id,property_id,agreement_type,commission_type,commission_value,starts_on,ends_on,company_id) values
 ('00000000-0000-0000-0000-00000000a201','00000000-0000-0000-0000-00000000o201','00000000-0000-0000-0000-00000000pr201','property_management','RATE',5,'2026-01-01','2027-12-31','00000000-0000-4000-8000-0000000000f3');
insert into public.units (id,property_id,unit_number,company_id) values ('00000000-0000-0000-0000-00000000u201','00000000-0000-0000-0000-00000000pr201','U1','00000000-0000-4000-8000-0000000000f3');
insert into public.people (id,full_name,type,company_id) values ('00000000-0000-0000-0000-00000000pe201','T1','tenant','00000000-0000-4000-8000-0000000000f3');
insert into public.contracts (id,property_id,unit_id,tenant_id,start_date,end_date,rent_amount,status,agreement_id,company_id) values
 ('00000000-0000-0000-0000-00000000t201','00000000-0000-0000-0000-00000000pr201','00000000-0000-0000-0000-00000000u201','00000000-0000-0000-0000-00000000pe201','2026-01-01','2026-12-31',12000,'active','00000000-0000-0000-0000-00000000a201','00000000-0000-4000-8000-0000000000f3');
insert into public.invoices (id,contract_id,issue_date,due_date,amount,paid_amount,tax_amount,status,company_id) values
 ('00000000-0000-0000-0000-00000000i201','00000000-0000-0000-0000-00000000t201','2026-07-01','2026-07-05',1000,1000,0,'PAID','00000000-0000-4000-8000-0000000000f3');
insert into public.receipts (id,amount,status,company_id) values ('00000000-0000-0000-0000-00000000p201',1000,'POSTED','00000000-0000-4000-8000-0000000000f3');
insert into public.payments (id,invoice_id,contract_id,amount,payment_method,payment_date,status,receipt_id,company_id) values
 ('00000000-0000-0000-0000-00000000p201','00000000-0000-0000-0000-00000000i201','00000000-0000-0000-0000-00000000t201',1000,'cash',date'2026-07-05','POSTED','00000000-0000-0000-0000-00000000p201','00000000-0000-4000-8000-0000000000f3');
insert into public.expenses (id,property_id,category,amount,expense_date,date_time,status,charged_to,description,company_id) values
 ('00000000-0000-0000-0000-00000000e201','00000000-0000-0000-0000-00000000pr201','maintenance',120,date'2026-07-10','2026-07-10','POSTED','OWNER','x','00000000-0000-4000-8000-0000000000f3');
SQL

run_create() {
  local actor="$1" req="$2" log="$3"
  psql "$DB_URL" -v ON_ERROR_STOP=0 -q -v VERBOSITY=terse >"$log" 2>&1 <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"${actor}","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000000f3"}}',false);
select public.create_owner_settlement_draft_atomic('{"request_id":"${req}","owner_id":"00000000-0000-0000-0000-00000000o201","property_id":"00000000-0000-0000-0000-00000000pr201","period_start":"2026-07-01","period_end":"2026-07-31"}'::jsonb);
commit;
SQL
}

# Fire both concurrently.
(
  run_create "00000000-0000-0000-0000-00000000f301" "00000000-0000-4000-8000-0000000000f301" "$T1_LOG"
) &
T1_PID=$!
(
  run_create "00000000-0000-0000-0000-00000000f302" "00000000-0000-4000-8000-0000000000f302" "$T2_LOG"
) &
T2_PID=$!
wait "$T1_PID"
wait "$T2_PID" || true

# Exactly one settlement for the target.
SETTLEMENTS=$(psql "$DB_URL" -Atqc "select count(*) from public.owner_settlements where owner_id='00000000-0000-0000-0000-00000000o201' and property_id='00000000-0000-0000-0000-00000000pr201' and period_start=date'2026-07-01' and period_end=date'2026-07-31' and status<>'CANCELLED'")
# The shared payment appears in exactly one ACTIVE (unreleased) link.
ACTIVE_PAY_LINKS=$(psql "$DB_URL" -Atqc "select count(*) from public.owner_settlement_payment_links where payment_id='00000000-0000-0000-0000-00000000p201' and released_at is null")

if [[ "$SETTLEMENTS" != "1" ]]; then
  echo "FA-003 concurrency failure: expected exactly 1 active settlement, found $SETTLEMENTS" >&2
  cat "$T1_LOG" "$T2_LOG" >&2
  exit 1
fi
if [[ "$ACTIVE_PAY_LINKS" != "1" ]]; then
  echo "FA-003 concurrency failure: expected exactly 1 active payment link, found $ACTIVE_PAY_LINKS" >&2
  cat "$T1_LOG" "$T2_LOG" >&2
  exit 1
fi
# No partial settlement: whichever transaction lost left zero rows for its request.
ORPHAN1=$(psql "$DB_URL" -Atqc "select count(*) from public.owner_settlements where request_id='00000000-0000-4000-8000-0000000000f301'::uuid")
ORPHAN2=$(psql "$DB_URL" -Atqc "select count(*) from public.owner_settlements where request_id='00000000-0000-4000-8000-0000000000f302'::uuid")
if (( ORPHAN1 + ORPHAN2 != 1 )); then
  echo "FA-003 concurrency failure: orphan settlements detected (req1=$ORPHAN1, req2=$ORPHAN2)" >&2
  exit 1
fi

printf 'FA-003 concurrency passed: exactly 1 active settlement, exactly 1 active payment link, no orphan rows.\n'
