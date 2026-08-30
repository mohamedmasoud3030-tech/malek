-- Enforce the canonical financial.reports.view permission at the database RPC
-- boundary. Existing report implementations move unchanged behind private core
-- names; canonical public signatures remain narrow guarded wrappers.

begin;

create or replace function app_private.require_financial_reports_view()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is not null then
    if not public.current_user_has_effective_app_permission('financial.reports.view') then
      raise exception 'FINANCIAL_REPORTS_VIEW_PERMISSION_REQUIRED' using errcode = '42501';
    end if;
    return;
  end if;

  if coalesce(auth.role(), '') = 'service_role'
     or session_user in ('postgres', 'supabase_admin') then
    return;
  end if;

  raise exception 'FINANCIAL_REPORTS_AUTH_REQUIRED' using errcode = '42501';
end;
$function$;

revoke all on function app_private.require_financial_reports_view() from public, anon, authenticated;
grant execute on function app_private.require_financial_reports_view() to service_role;

alter function public.rpt_trial_balance(date) set schema app_private;
alter function app_private.rpt_trial_balance(date) rename to financial_trial_balance_core;

alter function public.rpt_income_statement(date,date) set schema app_private;
alter function app_private.rpt_income_statement(date,date) rename to financial_income_statement_core;

alter function public.rpt_balance_sheet(date) set schema app_private;
alter function app_private.rpt_balance_sheet(date) rename to financial_balance_sheet_core;

alter function public.rpt_general_ledger(date,date) set schema app_private;
alter function app_private.rpt_general_ledger(date,date) rename to financial_general_ledger_core;

alter function public.rpt_cash_flow(date,date) set schema app_private;
alter function app_private.rpt_cash_flow(date,date) rename to financial_legacy_cash_flow_core;

alter function public.rpt_vat_return(date,date) set schema app_private;
alter function app_private.rpt_vat_return(date,date) rename to financial_vat_return_core;

alter function public.wp05_rpt_cash_flow_gl(date,date) set schema app_private;
alter function app_private.wp05_rpt_cash_flow_gl(date,date) rename to financial_cash_flow_gl_core;

revoke all on function app_private.financial_trial_balance_core(date) from public, anon, authenticated;
revoke all on function app_private.financial_income_statement_core(date,date) from public, anon, authenticated;
revoke all on function app_private.financial_balance_sheet_core(date) from public, anon, authenticated;
revoke all on function app_private.financial_general_ledger_core(date,date) from public, anon, authenticated;
revoke all on function app_private.financial_legacy_cash_flow_core(date,date) from public, anon, authenticated;
revoke all on function app_private.financial_vat_return_core(date,date) from public, anon, authenticated;
revoke all on function app_private.financial_cash_flow_gl_core(date,date) from public, anon, authenticated;

create function public.rpt_trial_balance(p_as_of date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform app_private.require_financial_reports_view();
  return app_private.financial_trial_balance_core(p_as_of);
end;
$function$;

create function public.rpt_income_statement(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform app_private.require_financial_reports_view();
  return app_private.financial_income_statement_core(p_from, p_to);
end;
$function$;

create function public.rpt_balance_sheet(p_as_of date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform app_private.require_financial_reports_view();
  return app_private.financial_balance_sheet_core(p_as_of);
end;
$function$;

create function public.rpt_general_ledger(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform app_private.require_financial_reports_view();
  return app_private.financial_general_ledger_core(p_from, p_to);
end;
$function$;

create function public.rpt_cash_flow(p_from_date date, p_to_date date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform app_private.require_financial_reports_view();
  return app_private.financial_legacy_cash_flow_core(p_from_date, p_to_date);
end;
$function$;

create function public.rpt_vat_return(p_from_date date, p_to_date date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform app_private.require_financial_reports_view();
  return app_private.financial_vat_return_core(p_from_date, p_to_date);
end;
$function$;

create function public.rpt_cash_flow_gl(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  perform app_private.require_financial_reports_view();
  return app_private.financial_cash_flow_gl_core(p_from, p_to);
end;
$function$;

-- Prevent direct browser calls around the guarded public wrappers.
revoke all on function public.wp05_rpt_trial_balance_gl(date) from public, anon, authenticated;
revoke all on function public.wp05_rpt_balance_sheet_gl(date) from public, anon, authenticated;
revoke all on function public.wp05_rpt_profit_loss_gl(date,date) from public, anon, authenticated;
revoke all on function public.wp05_rpt_general_ledger_gl(date,date,text) from public, anon, authenticated;
grant execute on function public.wp05_rpt_trial_balance_gl(date) to service_role;
grant execute on function public.wp05_rpt_balance_sheet_gl(date) to service_role;
grant execute on function public.wp05_rpt_profit_loss_gl(date,date) to service_role;
grant execute on function public.wp05_rpt_general_ledger_gl(date,date,text) to service_role;

revoke all on function public.rpt_trial_balance(date) from public, anon, authenticated;
revoke all on function public.rpt_income_statement(date,date) from public, anon, authenticated;
revoke all on function public.rpt_balance_sheet(date) from public, anon, authenticated;
revoke all on function public.rpt_general_ledger(date,date) from public, anon, authenticated;
revoke all on function public.rpt_cash_flow(date,date) from public, anon, authenticated;
revoke all on function public.rpt_vat_return(date,date) from public, anon, authenticated;
revoke all on function public.rpt_cash_flow_gl(date,date) from public, anon, authenticated;
grant execute on function public.rpt_trial_balance(date) to authenticated, service_role;
grant execute on function public.rpt_income_statement(date,date) to authenticated, service_role;
grant execute on function public.rpt_balance_sheet(date) to authenticated, service_role;
grant execute on function public.rpt_general_ledger(date,date) to authenticated, service_role;
grant execute on function public.rpt_cash_flow(date,date) to authenticated, service_role;
grant execute on function public.rpt_vat_return(date,date) to authenticated, service_role;
grant execute on function public.rpt_cash_flow_gl(date,date) to authenticated, service_role;

comment on function app_private.require_financial_reports_view() is
  'Fail-closed server-side authority gate for canonical financial report RPCs.';

commit;
