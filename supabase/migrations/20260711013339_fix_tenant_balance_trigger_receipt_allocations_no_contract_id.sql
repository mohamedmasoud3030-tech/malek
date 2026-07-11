-- update_tenant_balance() is shared by triggers on `invoices` (has
-- contract_id) and `receipt_allocations` (has no contract_id, but does have
-- its own tenant_id column). The function unconditionally referenced
-- NEW.contract_id / OLD.contract_id, which Postgres resolves at compile time
-- against the actual row type of whichever table fired the trigger -- so any
-- INSERT/UPDATE/DELETE on `receipt_allocations` failed with "record NEW has
-- no field contract_id". This broke post_receipt_atomic (and therefore
-- record_invoice_payment_atomic, void_receipt_atomic, and any direct receipt
-- posting) every time an allocation row was written. Fixed by branching on
-- TG_TABLE_NAME: for invoices, resolve tenant_id via the contract as before;
-- for receipt_allocations, use its own tenant_id column directly.
CREATE OR REPLACE FUNCTION public.update_tenant_balance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_tenant_id text;
begin
  if tg_table_name = 'invoices' then
    if tg_op = 'DELETE' then
      select tenant_id
      into v_tenant_id
      from public.contracts
      where id = old.contract_id;
    else
      select tenant_id
      into v_tenant_id
      from public.contracts
      where id = new.contract_id;
    end if;
  else
    -- receipt_allocations: has its own tenant_id column, no contract_id.
    if tg_op = 'DELETE' then
      v_tenant_id := old.tenant_id;
    else
      v_tenant_id := new.tenant_id;
    end if;
  end if;

  if v_tenant_id is null then
    return coalesce(new, old);
  end if;

  insert into public.tenant_balances (
    tenant_id,
    balance_due,
    updated_at
  )
  select
    c.tenant_id,
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - i.paid_amount), 0),
    now()
  from public.contracts c
  left join public.invoices i
    on i.contract_id = c.id
   and i.deleted_at is null
  where c.tenant_id = v_tenant_id
  group by c.tenant_id
  on conflict (tenant_id) do update set
    balance_due = excluded.balance_due,
    updated_at = now();

  return coalesce(new, old);
end;
$function$;
