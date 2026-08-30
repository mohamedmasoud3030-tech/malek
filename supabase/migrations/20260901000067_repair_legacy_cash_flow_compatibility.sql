begin;

-- Hosted compatibility repair only. Fresh canonical replays no longer expose
-- this legacy WP-named RPC. If an older hosted schema still has the guarded
-- wrapper, repoint its body to the canonical private core so the currently
-- deployed frontend remains functional during the RPC-name transition.
do $compat$
declare
  v_sql text;
begin
  if to_regprocedure('public.wp05_rpt_cash_flow_gl(date,date)') is null then
    return;
  end if;

  v_sql :=
    'create or replace function public.' || quote_ident('wp05_rpt_cash_flow_gl') || '(p_from date, p_to date) '
    || 'returns jsonb language plpgsql security definer set search_path to ''public'', ''pg_temp'' as $body$ '
    || 'begin perform app_private.require_financial_reports_view(); '
    || 'return app_private.financial_cash_flow_gl_core(p_from, p_to); end; $body$';
  execute v_sql;

  revoke all on function public.wp05_rpt_cash_flow_gl(date,date) from public, anon, authenticated;
  grant execute on function public.wp05_rpt_cash_flow_gl(date,date) to authenticated, service_role;
end
$compat$;

commit;
