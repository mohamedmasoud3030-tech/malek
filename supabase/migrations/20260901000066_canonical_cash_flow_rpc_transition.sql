begin;

-- Normalize private implementation names installed by the first live revision
-- of migration 64. Fresh canonical replays already use the target names, so
-- every rename is conditional and becomes a no-op there.
do $rename$
begin
  if to_regprocedure('app_private.rpt_trial_balance_impl(date)') is not null
     and to_regprocedure('app_private.financial_trial_balance_core(date)') is null then
    alter function app_private.rpt_trial_balance_impl(date) rename to financial_trial_balance_core;
  end if;
  if to_regprocedure('app_private.rpt_income_statement_impl(date,date)') is not null
     and to_regprocedure('app_private.financial_income_statement_core(date,date)') is null then
    alter function app_private.rpt_income_statement_impl(date,date) rename to financial_income_statement_core;
  end if;
  if to_regprocedure('app_private.rpt_balance_sheet_impl(date)') is not null
     and to_regprocedure('app_private.financial_balance_sheet_core(date,date)') is null then
    alter function app_private.rpt_balance_sheet_impl(date) rename to financial_balance_sheet_core;
  end if;
  if to_regprocedure('app_private.rpt_general_ledger_impl(date,date)') is not null
     and to_regprocedure('app_private.financial_general_ledger_core(date,date)') is null then
    alter function app_private.rpt_general_ledger_impl(date,date) rename to financial_general_ledger_core;
  end if;
  if to_regprocedure('app_private.rpt_cash_flow_impl(date,date)') is not null
     and to_regprocedure('app_private.financial_legacy_cash_flow_core(date,date)') is null then
    alter function app_private.rpt_cash_flow_impl(date,date) rename to financial_legacy_cash_flow_core;
  end if;
  if to_regprocedure('app_private.rpt_vat_return_impl(date,date)') is not null
     and to_regprocedure('app_private.financial_vat_return_core(date,date)') is null then
    alter function app_private.rpt_vat_return_impl(date,date) rename to financial_vat_return_core;
  end if;
  if to_regprocedure('app_private.wp05_rpt_cash_flow_gl_impl(date,date)') is not null
     and to_regprocedure('app_private.financial_cash_flow_gl_core(date,date)') is null then
    alter function app_private.wp05_rpt_cash_flow_gl_impl(date,date) rename to financial_cash_flow_gl_core;
  end if;
end
$rename$;

create or replace function public.rpt_cash_flow_gl(p_from date, p_to date)
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

revoke all on function public.rpt_cash_flow_gl(date,date) from public, anon, authenticated;
grant execute on function public.rpt_cash_flow_gl(date,date) to authenticated, service_role;

-- A hosted environment may temporarily retain the old guarded wrapper until
-- its frontend deploy switches to rpt_cash_flow_gl. Fresh replays never create
-- a new sprint/version-named public API.
do $compat$
begin
  if to_regprocedure('public.wp05_rpt_cash_flow_gl(date,date)') is not null then
    comment on function public.wp05_rpt_cash_flow_gl(date,date) is
      'Deprecated compatibility alias. Use public.rpt_cash_flow_gl(date,date); guarded by financial.reports.view.';
  end if;
end
$compat$;

commit;
