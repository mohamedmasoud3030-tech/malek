begin;

create or replace function public.rpt_trial_balance(p_as_of date)
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

create or replace function public.rpt_income_statement(p_from date, p_to date)
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

create or replace function public.rpt_balance_sheet(p_as_of date)
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

create or replace function public.rpt_general_ledger(p_from date, p_to date)
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

create or replace function public.rpt_cash_flow(p_from_date date, p_to_date date)
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

create or replace function public.rpt_vat_return(p_from_date date, p_to_date date)
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

revoke all on function public.rpt_trial_balance(date) from public, anon;
grant execute on function public.rpt_trial_balance(date) to authenticated, service_role;
revoke all on function public.rpt_income_statement(date,date) from public, anon;
grant execute on function public.rpt_income_statement(date,date) to authenticated, service_role;
revoke all on function public.rpt_balance_sheet(date) from public, anon;
grant execute on function public.rpt_balance_sheet(date) to authenticated, service_role;
revoke all on function public.rpt_general_ledger(date,date) from public, anon;
grant execute on function public.rpt_general_ledger(date,date) to authenticated, service_role;
revoke all on function public.rpt_cash_flow(date,date) from public, anon;
grant execute on function public.rpt_cash_flow(date,date) to authenticated, service_role;
revoke all on function public.rpt_vat_return(date,date) from public, anon;
grant execute on function public.rpt_vat_return(date,date) to authenticated, service_role;

comment on function public.rpt_vat_return(date,date) is 'Canonical VAT report wrapper using app_private.financial_vat_return_core; exposed to authenticated/service_role through PostgREST.';

commit;

notify pgrst, 'reload schema';