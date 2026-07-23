create or replace function public.rpt_dashboard_overview(
  p_from date,
  p_to date,
  p_as_of date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_financial record;
  v_result jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;

  select * into v_financial
  from public.rpt_financial_summary(p_from, p_to);

  select jsonb_build_object(
    'financial', jsonb_build_object(
      'total_collected', coalesce(v_financial.collected, 0),
      'total_overdue_invoices', coalesce(v_financial.overdue_amount, 0),
      'total_expenses', coalesce(v_financial.expenses, 0),
      'net_revenue', coalesce(v_financial.net, 0)
    ),
    'operational', jsonb_build_object(
      'properties', (select count(*) from public.properties where deleted_at is null),
      'units', (select count(*) from public.units where deleted_at is null),
      'activeContracts', (
        select count(*)
        from public.contracts
        where deleted_at is null
          and upper(coalesce(status::text, '')) = 'ACTIVE'
      ),
      'expiringContracts30Days', (
        select count(*)
        from public.contracts
        where deleted_at is null
          and upper(coalesce(status::text, '')) = 'ACTIVE'
          and btrim(coalesce(end_date::text, '')) ~ '^\d{4}-\d{2}-\d{2}$'
          and btrim(end_date::text)::date >= p_as_of
          and btrim(end_date::text)::date <= (p_as_of + interval '30 days')::date
      ),
      'vacantUnits', (
        select count(*)
        from public.units
        where deleted_at is null
          and lower(coalesce(status::text, '')) in ('available', 'vacant')
      ),
      'overdueInvoices', (
        select count(*)
        from public.invoices
        where deleted_at is null
          and upper(coalesce(status::text, '')) = 'OVERDUE'
      )
    )
  ) into v_result;

  return v_result;
end;
$function$;

alter function public.rpt_dashboard_overview(date, date, date) owner to postgres;
revoke all on function public.rpt_dashboard_overview(date, date, date) from public, anon;
grant execute on function public.rpt_dashboard_overview(date, date, date) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
