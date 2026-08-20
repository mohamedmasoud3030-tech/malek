-- Manual rollback for 20260831120000_record_invoice_payment_return_payment_id.sql
-- Emergency / not auto-applied. Restores the public collect RPC name onto the
-- RC1 engine and drops the compatibility wrapper.

begin;

drop function if exists public.record_invoice_payment_atomic(jsonb);

do $restore$
begin
  if to_regprocedure('public.record_invoice_payment_atomic_engine(jsonb)') is not null
     and to_regprocedure('public.record_invoice_payment_atomic(jsonb)') is null then
    alter function public.record_invoice_payment_atomic_engine(jsonb)
      rename to record_invoice_payment_atomic;
  end if;
end
$restore$;

grant execute on function public.record_invoice_payment_atomic(jsonb)
  to authenticated, service_role;

commit;
