-- FIN-013/016/019, SEC-001/002/009; GAP-013.
-- One reconciliation implementation; preserve both public response contracts.
-- The legacy adapter must not recompute current balances or omit reversed GL.
-- Use the existing report permission gate, with explicit company validation
-- before privileged reads. No new grants, tables, financial writes or backfill.
begin;
do $precondition$
begin
  if to_regprocedure('app_private.financial_reconciliation_core(uuid,date)') is not null
    or to_regprocedure('app_private.require_financial_reports_view()') is null
    or not exists(select 1 from pg_proc where oid='public.wp05_reconcile_all(uuid,date)'::regprocedure and not prosecdef and provolatile='s')
    or not exists(select 1 from pg_proc where oid='public.gl_reconcile_subledgers(date)'::regprocedure and prosecdef and provolatile='s') then
    raise exception 'RECONCILIATION_ENTRY_BOUNDARY_PRECONDITION';
  end if;
end;
$precondition$;

alter function public.wp05_reconcile_all(uuid,date) set schema app_private;
alter function app_private.wp05_reconcile_all(uuid,date) rename to financial_reconciliation_core;
revoke all on function app_private.financial_reconciliation_core(uuid,date) from public,anon,authenticated;
grant execute on function app_private.financial_reconciliation_core(uuid,date) to service_role;

create function public.wp05_reconcile_all(
  p_company_id uuid default public.current_company_id(),p_as_of date default current_date
) returns table(reconciliation_class text,account_no text,account_name text,subledger_balance numeric,
 gl_balance numeric,variance numeric,abs_variance numeric,currency text,reconciliation_status text,subledger_count bigint,gl_count bigint)
language plpgsql stable security definer set search_path to 'public','pg_temp'
as $function$
begin
  perform app_private.require_financial_reports_view();
  if p_company_id is null or p_as_of is null then
    raise exception 'WP05_RECONCILE_COMPANY_DATE_REQUIRED' using errcode='22023';
  end if;
  if auth.uid() is not null and p_company_id is distinct from public.require_company_id() then
    raise exception 'WP05_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
  end if;
  return query select * from app_private.financial_reconciliation_core(p_company_id,p_as_of);
end;
$function$;
revoke all on function public.wp05_reconcile_all(uuid,date) from public,anon,authenticated;
grant execute on function public.wp05_reconcile_all(uuid,date) to authenticated,service_role;

create or replace function public.gl_reconcile_subledgers(p_as_of_date date default current_date)
returns table(account_no text,account_name text,gl_balance numeric,subledger_balance numeric,mismatch numeric,is_reconciled boolean,details jsonb)
language plpgsql stable security definer set search_path to 'public','pg_temp'
as $function$
begin
  return query
  select r.account_no,r.account_name,r.gl_balance,r.subledger_balance,
    r.gl_balance-r.subledger_balance,r.reconciliation_status='PASS',
    jsonb_build_object('account',r.account_no,'type',case when r.account_no in ('1201','1300') then 'asset' else 'liability' end)
  from public.wp05_reconcile_all(public.require_company_id(),p_as_of_date) r
  where r.account_no in ('2000','1201','2200','1300','2300')
  order by array_position(array['2000','1201','2200','1300','2300'],r.account_no);
end;
$function$;
-- CREATE OR REPLACE retains legacy grants/owner and the original response shape.
comment on function public.gl_reconcile_subledgers(date) is 'Compatibility shape adapter over the single guarded WP05 reconciliation authority; no independent financial calculation.';
commit;
