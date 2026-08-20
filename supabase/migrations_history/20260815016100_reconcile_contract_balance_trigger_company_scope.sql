-- A live-only legacy trigger recalculates contract_balances on any invoice
-- update but omits the now-required company_id column. Preserve the trigger
-- behavior while deriving company_id from the contract, so reference backfill
-- and every later invoice update remain tenant-scoped.

create or replace function public.update_contract_balance_on_invoice()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_contract_id text;
begin
  v_contract_id := case when tg_op = 'DELETE'
    then old.contract_id else new.contract_id end;

  insert into public.contract_balances (
    contract_id,
    tenant_id,
    unit_id,
    total_invoiced,
    total_paid,
    balance_due,
    updated_at,
    company_id
  )
  select
    c.id,
    c.tenant_id,
    c.unit_id::text,
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0)), 0),
    coalesce(sum(i.paid_amount), 0),
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - i.paid_amount), 0),
    now(),
    c.company_id
  from public.contracts c
  left join public.invoices i
    on i.contract_id = c.id
   and i.deleted_at is null
   and i.company_id = c.company_id
  where c.id = v_contract_id
  group by c.id, c.tenant_id, c.unit_id, c.company_id
  on conflict (contract_id) do update set
    tenant_id = excluded.tenant_id,
    unit_id = excluded.unit_id,
    total_invoiced = excluded.total_invoiced,
    total_paid = excluded.total_paid,
    balance_due = excluded.balance_due,
    updated_at = now(),
    company_id = excluded.company_id;

  return coalesce(new, old);
end;
$function$;

alter function public.update_contract_balance_on_invoice() owner to postgres;
revoke all on function public.update_contract_balance_on_invoice()
  from public, anon, authenticated;
