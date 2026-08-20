-- owner_settlements.owner_id is text but owners.id / p_owner_id is uuid.
-- s.owner_id = p_owner_id had no operator and would raise a hard error the
-- moment any settlement rows existed in the date range. Not wired into the
-- frontend yet, so zero live impact, but fixing while auditing this class
-- of bug. Signature unchanged.

create or replace function public.rpt_owner_statement(p_owner_id uuid, p_from date, p_to date)
 returns jsonb
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_owner            record;
  v_transactions     jsonb;
  v_total_gross      numeric := 0;
  v_total_deductions numeric := 0;
  v_total_net        numeric := 0;
begin
  select name, commission_type, commission_value
  into   v_owner
  from   owners where id = p_owner_id;

  if not found then
    return jsonb_build_object('error', 'owner not found');
  end if;

  with owner_contracts as (
    select c.id as contract_id, u.id as unit_id, u.name as unit_name, pr.name as property_name
    from   contracts c
    join   units      u  on u.id  = c.unit_id
    join   properties pr on pr.id = u.property_id
    where  pr.owner_id = p_owner_id
  ),
  receipts_rows as (
    select
      r.date_time::text as tx_date,
      'تحصيل — ' || oc.property_name || ' / ' || oc.unit_name || ' (سند ' || r.no || ')' as details,
      'receipt' as tx_type, oc.property_name,
      r.amount as gross,
      case when v_owner.commission_type = 'RATE'
        then _r3(r.amount * v_owner.commission_value / 100) else 0 end as deduction,
      r.no
    from receipts r
    join owner_contracts oc on oc.contract_id = r.contract_id
    where r.status = 'POSTED' and _safe_date(r.date_time) between p_from and p_to
  ),
  expense_rows as (
    select
      e.date_time::text as tx_date,
      'مصروف — ' || coalesce(e.description, e.category) as details,
      'expense' as tx_type, coalesce(pr.name,'') as property_name,
      -e.amount as gross, 0 as deduction, e.no
    from expenses e
    left join contracts  c  on c.id  = e.contract_id
    left join units      u  on u.id  = c.unit_id
    left join properties pr on pr.id = coalesce(u.property_id, e.property_id)
    where e.status = 'POSTED' and e.charged_to = 'OWNER'
      and _safe_date(e.date_time) between p_from and p_to
      and (
        (c.id is not null and u.property_id in (select property_id from owner_contracts limit 1))
        or (e.property_id in (select id from properties where owner_id = p_owner_id))
      )
  ),
  settlement_rows as (
    select s.date::text as tx_date, 'تسوية مالية رقم ' || s.no as details,
      'settlement' as tx_type, '' as property_name,
      -s.amount as gross, 0 as deduction, s.no
    from owner_settlements s
    where s.owner_id = p_owner_id::text and _safe_date(s.date) between p_from and p_to
  ),
  all_tx as (
    select * from receipts_rows union all
    select * from expense_rows  union all
    select * from settlement_rows
  )
  select
    jsonb_agg(jsonb_build_object(
      'date', tx_date, 'details', details, 'type', tx_type,
      'property_name', property_name, 'gross', _r3(gross),
      'deduction', _r3(deduction), 'net', _r3(gross - deduction)
    ) order by tx_date, no),
    _r3(sum(gross)), _r3(sum(deduction)), _r3(sum(gross - deduction))
  into v_transactions, v_total_gross, v_total_deductions, v_total_net
  from all_tx;

  return jsonb_build_object(
    'owner_name', v_owner.name, 'commission_type', v_owner.commission_type,
    'commission_value', v_owner.commission_value,
    'transactions', coalesce(v_transactions, '[]'::jsonb),
    'total_gross', coalesce(v_total_gross, 0),
    'total_deductions', coalesce(v_total_deductions, 0),
    'total_net', coalesce(v_total_net, 0),
    'period_from', p_from, 'period_to', p_to
  );
end;
$function$;
