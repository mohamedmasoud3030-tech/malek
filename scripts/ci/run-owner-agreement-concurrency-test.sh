#!/usr/bin/env bash
set -Eeuo pipefail

# FA-004 real PostgreSQL concurrency check. The first transaction keeps the
# FOR UPDATE lock open after the RPC returns; the second transaction must wait
# until the first commits, then update the same in-company row.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

STATUS_ENV="$(mktemp)"
T1_LOG="$(mktemp)"
T2_LOG="$(mktemp)"
cleanup() {
  set +e
  [[ -n "${DB_URL:-}" ]] && psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
    delete from public.owner_agreements where id = '00000000-0000-0000-0000-00000000c301';
    delete from public.properties where id = '00000000-0000-0000-0000-00000000c201';
    delete from public.owners where id = '00000000-0000-0000-0000-00000000c101';
    delete from public.company_members where company_id = '00000000-0000-4000-8000-0000000000c1';
    delete from public.companies where id = '00000000-0000-4000-8000-0000000000c1';
    delete from public.users where id in ('00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-00000000c002');
    delete from auth.users where id in ('00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-00000000c002');
SQL
  rm -f "$STATUS_ENV" "$T1_LOG" "$T2_LOG"
}
trap cleanup EXIT

pnpm exec supabase status --output env >"$STATUS_ENV"
DB_URL="$(sed -n 's/^DB_URL=//p' "$STATUS_ENV" | tr -d '"' | tail -n 1)"
: "${DB_URL:?DB_URL was not reported by Supabase status}"

psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
insert into public.companies (id, name, slug)
values ('00000000-0000-4000-8000-0000000000c1', 'FA4 Concurrency Company', 'fa4-concurrency')
on conflict (id) do nothing;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
 ('00000000-0000-0000-0000-00000000c001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fa4-c1@test.invalid','not-used',now(),now(),now(),'{}','{}'),
 ('00000000-0000-0000-0000-00000000c002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fa4-c2@test.invalid','not-used',now(),now(),now(),'{}','{}')
on conflict (id) do nothing;
insert into public.users (id,email,name,role,status,is_active) values
 ('00000000-0000-0000-0000-00000000c001','fa4-c1@test.invalid','FA4 C1','ADMIN','ACTIVE',true),
 ('00000000-0000-0000-0000-00000000c002','fa4-c2@test.invalid','FA4 C2','ADMIN','ACTIVE',true)
on conflict (id) do update set role='ADMIN',status='ACTIVE',is_active=true;
insert into public.company_members (company_id,user_id,role) values
 ('00000000-0000-4000-8000-0000000000c1','00000000-0000-0000-0000-00000000c001','ADMIN'),
 ('00000000-0000-4000-8000-0000000000c1','00000000-0000-0000-0000-00000000c002','ADMIN')
on conflict (company_id,user_id) do update set role='ADMIN';
insert into public.owners (id,full_name,company_id) values
 ('00000000-0000-0000-0000-00000000c101','FA4 C Owner','00000000-0000-4000-8000-0000000000c1');
insert into public.properties (id,title,type,address,status,company_id) values
 ('00000000-0000-0000-0000-00000000c201','FA4 C Property','residential','FA4 C','active','00000000-0000-4000-8000-0000000000c1');
insert into public.owner_agreements (id,owner_id,property_id,agreement_type,commission_type,commission_value,starts_on,ends_on,company_id) values
 ('00000000-0000-0000-0000-00000000c301','00000000-0000-0000-0000-00000000c101','00000000-0000-0000-0000-00000000c201','property_management','RATE',5,'2026-01-01','2027-12-31','00000000-0000-4000-8000-0000000000c1');
SQL

# T1 holds the row lock for five seconds after the RPC has updated it.
(
  psql "$DB_URL" -v ON_ERROR_STOP=1 -q -v VERBOSITY=terse >"$T1_LOG" 2>&1 <<'SQL'
\timing on
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000c001","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000000c1"}}',false);
select public.update_owner_agreement_atomic('00000000-0000-0000-0000-00000000c301','{"notes":"lock-holder"}'::jsonb);
select pg_sleep(5);
commit;
SQL
) &
T1_PID=$!
sleep 1

# T2 must block on the same FOR UPDATE row lock, then complete after T1 commits.
START_NS="$(date +%s%N)"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -v VERBOSITY=terse >"$T2_LOG" 2>&1 <<'SQL'
\timing on
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-00000000c002","role":"authenticated","app_metadata":{"user_role":"ADMIN","company_id":"00000000-0000-4000-8000-0000000000c1"}}',false);
select public.update_owner_agreement_atomic('00000000-0000-0000-0000-00000000c301','{"notes":"after-lock"}'::jsonb);
commit;
SQL
END_NS="$(date +%s%N)"
wait "$T1_PID"
ELAPSED_MS=$(( (END_NS - START_NS) / 1000000 ))

# A wait of at least four seconds proves T2 did not silently overwrite while
# T1 retained the row lock. Also verify the second update committed.
if (( ELAPSED_MS < 4000 )); then
  echo "FA-004 concurrency failure: second transaction completed in ${ELAPSED_MS}ms" >&2
  cat "$T1_LOG" "$T2_LOG" >&2
  exit 1
fi
FINAL_NOTE="$(psql "$DB_URL" -Atqc "select notes from public.owner_agreements where id='00000000-0000-0000-0000-00000000c301'")"
if [[ "$FINAL_NOTE" != "after-lock" ]]; then
  echo "FA-004 concurrency failure: final note was '$FINAL_NOTE'" >&2
  exit 1
fi
printf 'FA-004 concurrency passed: second transaction waited %sms and committed after the row lock.\n' "$ELAPSED_MS"
