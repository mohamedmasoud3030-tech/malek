create or replace function public.rpt_daily_collection(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_rows jsonb;
  v_total numeric := 0;
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required to run daily collection reports.'
      using errcode = '42501';
  end if;

  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'A valid report date range is required.'
      using errcode = '22023';
  end if;

  with reportable_payments as (
    select
      coalesce(p.payment_date, public._safe_date(p.date_time::text)) as collection_date,
      upper(coalesce(nullif(p.payment_method, ''), nullif(p.channel, ''), 'OTHER')) as method,
      coalesce(p.amount, 0)::numeric as amount
    from public.payments p
    where p.deleted_at is null
      and upper(coalesce(p.status, 'POSTED')) <> 'VOID'
      and coalesce(p.payment_date, public._safe_date(p.date_time::text)) between p_from and p_to
  ), daily as (
    select
      collection_date,
      sum(amount)::numeric as day_total,
      sum(amount) filter (where method = 'CASH')::numeric as cash,
      sum(amount) filter (where method in ('BANK', 'BANK_TRANSFER'))::numeric as bank,
      sum(amount) filter (where method in ('POS', 'CARD'))::numeric as pos,
      sum(amount) filter (
        where method not in ('CASH', 'BANK', 'BANK_TRANSFER', 'POS', 'CARD')
      )::numeric as other,
      count(*)::bigint as payments_count
    from reportable_payments
    group by collection_date
  )
  select
    jsonb_agg(
      jsonb_build_object(
        'date', collection_date::text,
        'total', public._r3(day_total),
        'cash', public._r3(coalesce(cash, 0)),
        'bank', public._r3(coalesce(bank, 0)),
        'pos', public._r3(coalesce(pos, 0)),
        'other', public._r3(coalesce(other, 0)),
        'count', payments_count
      )
      order by collection_date
    ),
    public._r3(coalesce(sum(day_total), 0))
  into v_rows, v_total
  from daily;

  return jsonb_build_object(
    'rows', coalesce(v_rows, '[]'::jsonb),
    'total', coalesce(v_total, 0),
    'from', p_from,
    'to', p_to,
    'source', 'payments'
  );
end;
$function$;

alter function public.rpt_daily_collection(date, date) owner to postgres;
revoke all on function public.rpt_daily_collection(date, date) from public, anon;
grant execute on function public.rpt_daily_collection(date, date) to authenticated, service_role;

commit;
