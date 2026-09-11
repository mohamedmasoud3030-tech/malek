begin;

do $rc1_remove_wp05_current_user_guard$
declare
  v_sql text;
  v_old text := $old$  -- Company isolation enforced by require_company_id and RLS, but double-check
  if public.current_company_id() is not null and public.current_company_id() <> v_company_id then
    if current_user not in ('service_role','postgres','supabase_admin') then
      raise exception 'WP05_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
    end if;
  end if;$old$;
  v_new text := $new$  -- Company isolation is enforced by require_company_id/current_company_id;
  -- do not use current_user inside SECURITY DEFINER as caller identity.
  if public.current_company_id() is null or public.current_company_id() <> v_company_id then
    raise exception 'WP05_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
  end if;$new$;
begin
  select pg_get_functiondef('public.wp05_rpt_cash_flow_gl(date,date)'::regprocedure) into v_sql;
  if position(v_old in v_sql) = 0 then
    raise exception 'RC1_WP05_CASH_FLOW_GUARD_ANCHOR_NOT_FOUND';
  end if;
  execute replace(v_sql, v_old, v_new);
end;
$rc1_remove_wp05_current_user_guard$;

alter function public.wp05_rpt_cash_flow_gl(date, date) owner to postgres;
revoke all on function public.wp05_rpt_cash_flow_gl(date, date) from public, anon;
grant execute on function public.wp05_rpt_cash_flow_gl(date, date) to authenticated, service_role;
commit;