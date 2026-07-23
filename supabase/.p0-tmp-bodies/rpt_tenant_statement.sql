create or replace function public.rpt_tenant_statement(p_contract_id uuid)
 returns jsonb
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare v_contract record; v_lines jsonb; v_balance numeric;
begin
  select c.*, t.full_name as tenant_name, t.phone as tenant_phone,
    u.name as unit_name, pr.name as property_name
  into v_contract from contracts c
  join people t on t.id=c.tenant_id join units u on u.id=c.unit_id
  join properties pr on pr.id=u.property_id where c.id=p_contract_id::text;
  if not found then return jsonb_build_object('error','contract not found'); end if;

  with tx as (
    select i.due_date as tx_date,
      'فاتورة رقم '||i.no||case when i.type<>'RENT' then ' ('||i.type||')' else '' end as description,
      'invoice' as tx_type, i.amount+coalesce(i.tax_amount,0) as debit, 0 as credit, i.no as ref_no
    from invoices i where i.contract_id=p_contract_id::text
    union all
    select left(r.date_time,10), 'سند قبض رقم '||r.no||' — '||r.channel,
      'receipt', 0, r.amount, r.no
    from receipts r where r.contract_id=p_contract_id::text and r.status='POSTED'
  ),
  with_balance as (
    select tx_date,description,tx_type,debit,credit,ref_no,
      sum(debit-credit) over (order by tx_date,ref_no rows unbounded preceding) as running_balance from tx
  )
  select jsonb_agg(jsonb_build_object('date',tx_date,'description',description,'type',tx_type,
    'debit',_r3(debit),'credit',_r3(credit),'balance',_r3(running_balance)) order by tx_date,ref_no),
    _r3(sum(debit-credit)) into v_lines, v_balance from with_balance;

  return jsonb_build_object('contract_id',p_contract_id,'tenant_name',v_contract.tenant_name,
    'tenant_phone',v_contract.tenant_phone,'unit_name',v_contract.unit_name,
    'property_name',v_contract.property_name,'start_date',v_contract.start_date,
    'end_date',v_contract.end_date,'lines',coalesce(v_lines,'[]'::jsonb),'final_balance',coalesce(v_balance,0));
end;
$function$;
