-- Rollback WP-01 receipt VOID Maker-Checker.
-- Restores the previous one-step executor and removes the request ledger.
-- Use only as an emergency forward rollback before any governed VOID requests
-- are relied upon; executed requests and their audit rows remain audit history.

begin;

drop function if exists public.request_receipt_void_atomic(jsonb);
drop function if exists public.approve_receipt_void_atomic(jsonb);
drop function if exists public.void_receipt_atomic(jsonb);

do $restore$
begin
  if to_regprocedure('public.execute_receipt_void_internal(jsonb)') is null then
    raise exception 'WP01_RECEIPT_VOID_ROLLBACK_ABORT: internal executor is missing.';
  end if;
  alter function public.execute_receipt_void_internal(jsonb)
    rename to void_receipt_atomic;
end
$restore$;

revoke all on function public.void_receipt_atomic(jsonb)
  from public, anon, authenticated;
grant execute on function public.void_receipt_atomic(jsonb)
  to authenticated, service_role;

drop table if exists public.receipt_void_requests;

comment on function public.void_receipt_atomic(jsonb) is
  'Pre-WP-01 direct receipt VOID executor restored by emergency rollback.';

commit;
