-- update_owner_balance_on_expense() is shared by triggers on both `expenses`
-- (which has property_id) and `receipts` (which does NOT have property_id).
-- The function unconditionally referenced NEW.property_id / OLD.property_id,
-- which Postgres resolves at compile time against the row type of whichever
-- table fired the trigger -- so any INSERT/UPDATE/DELETE on `receipts` failed
-- with "record NEW has no field property_id", regardless of which branch of
-- the COALESCE would have been used at runtime. This broke every path that
-- posts a receipt, including record_invoice_payment_atomic (rent payments)
-- and post_receipt_atomic directly -- meaning no receipt has ever been
-- successfully posted in production. Fixed by branching on TG_TABLE_NAME so
-- property_id is only read when the trigger actually fired on `expenses`.
CREATE OR REPLACE FUNCTION public.update_owner_balance_on_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_property_id text;
  v_contract_id text;
begin
  if tg_table_name = 'expenses' then
    v_property_id := coalesce(NEW.property_id, OLD.property_id);
    v_contract_id := coalesce(NEW.contract_id, OLD.contract_id);
  else
    v_property_id := null;
    v_contract_id := coalesce(NEW.contract_id, OLD.contract_id);
  end if;

  insert into owner_balances (owner_id, total_income, total_expenses, commission, net_balance, updated_at)
  select o.id,
    coalesce(sum(case when r.status = 'POSTED' then r.amount else 0 end), 0),
    coalesce(sum(case when e.status = 'POSTED' and e.charged_to in ('OWNER', 'OFFICE') then e.amount else 0 end), 0),
    coalesce(sum(case when r.status = 'POSTED' then r.amount * coalesce(o.commission_value / 100, 0.05) else 0 end), 0),
    0,
    now()
  from owners o
  left join properties p on p.owner_id = o.id
  left join units u on u.property_id = p.id
  -- Removed "and c.status = 'ACTIVE'" filter: lifetime totals must include
  -- receipts/expenses from ENDED (renewed/terminated) contracts.
  left join contracts c on c.unit_id = u.id and c.deleted_at is null
  left join receipts r on r.contract_id = c.id
  left join expenses e on (e.contract_id = c.id or e.property_id = p.id)
  where o.id = coalesce(
    (select owner_id from properties where id = v_property_id),
    (select p2.owner_id from contracts c2 join properties p2 on p2.id = c2.property_id where c2.id = v_contract_id)
  )
  group by o.id, o.commission_value
  on conflict (owner_id) do update set
    total_income = excluded.total_income,
    total_expenses = excluded.total_expenses,
    commission = excluded.commission,
    net_balance = excluded.total_income - excluded.total_expenses - excluded.commission,
    updated_at = now();
  return coalesce(NEW, OLD);
end;
$function$;
