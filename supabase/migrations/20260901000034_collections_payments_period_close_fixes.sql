-- MALEK RC1 Group 3 — Collections, Payments & Period Close fixes
-- Fixes contract/tenant balances to include credited_amount and adds missing triggers.
-- Preserves history: never deletes posted financial history, void/credit are append-only.
-- Ensures period close does not reopen for late payment (gl_resolve already handles).

-- Fix contract balance from allocation: include credited_amount
CREATE OR REPLACE FUNCTION public.update_contract_balance_from_allocation()
    RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_contract_id text;
  v_total_invoiced numeric;
  v_total_paid numeric;
  v_total_credited numeric;
  v_tenant_id text;
  v_unit_id text;
  v_company_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT i.contract_id::text INTO v_contract_id
    FROM public.invoices i
    WHERE i.id::text = OLD.invoice_id::text;
  ELSE
    SELECT i.contract_id::text INTO v_contract_id
    FROM public.invoices i
    WHERE i.id::text = NEW.invoice_id::text;
  END IF;

  IF v_contract_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT 
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    COALESCE(SUM(i.credited_amount), 0),
    c.tenant_id::text,
    c.unit_id::text,
    c.company_id
  INTO v_total_invoiced, v_total_paid, v_total_credited, v_tenant_id, v_unit_id, v_company_id
  FROM public.contracts c
  LEFT JOIN public.invoices i ON i.contract_id::text = c.id::text AND i.deleted_at IS NULL
  WHERE c.id::text = v_contract_id::text
  GROUP BY c.tenant_id, c.unit_id, c.company_id;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at, company_id
  ) VALUES (
    v_contract_id::uuid,
    v_tenant_id::uuid,
    v_unit_id::uuid,
    v_total_invoiced,
    v_total_paid,
    v_total_invoiced - v_total_paid - v_total_credited,
    now(),
    v_company_id
  )
  ON CONFLICT (contract_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    unit_id = EXCLUDED.unit_id,
    total_invoiced = EXCLUDED.total_invoiced,
    total_paid = EXCLUDED.total_paid,
    balance_due = EXCLUDED.balance_due,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix contract balance from invoice (triggered on invoices)
CREATE OR REPLACE FUNCTION public.update_contract_balance_from_invoice()
    RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_contract_id text;
  v_total_invoiced numeric;
  v_total_paid numeric;
  v_total_credited numeric;
  v_tenant_id text;
  v_unit_id text;
  v_company_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contract_id := OLD.contract_id::text;
  ELSE
    v_contract_id := NEW.contract_id::text;
  END IF;

  IF v_contract_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT 
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    COALESCE(SUM(i.credited_amount), 0),
    c.tenant_id::text,
    c.unit_id::text,
    c.company_id
  INTO v_total_invoiced, v_total_paid, v_total_credited, v_tenant_id, v_unit_id, v_company_id
  FROM public.contracts c
  LEFT JOIN public.invoices i ON i.contract_id::text = c.id::text AND i.deleted_at IS NULL
  WHERE c.id::text = v_contract_id::text
  GROUP BY c.tenant_id, c.unit_id, c.company_id;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, company_id, updated_at
  ) VALUES (
    v_contract_id::uuid,
    v_tenant_id::uuid,
    v_unit_id::uuid,
    v_total_invoiced,
    v_total_paid,
    v_total_invoiced - v_total_paid - v_total_credited,
    v_company_id,
    now()
  )
  ON CONFLICT (contract_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    unit_id = EXCLUDED.unit_id,
    total_invoiced = EXCLUDED.total_invoiced,
    total_paid = EXCLUDED.total_paid,
    balance_due = EXCLUDED.balance_due,
    company_id = EXCLUDED.company_id,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Fix update_contract_balance_on_invoice (second variant used by baseline)
CREATE OR REPLACE FUNCTION public.update_contract_balance_on_invoice()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_contract_id uuid;
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
    c.unit_id,
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0)), 0),
    coalesce(sum(i.paid_amount), 0),
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - coalesce(i.paid_amount,0) - coalesce(i.credited_amount,0)), 0),
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
$$;

-- Fix update_contract_balance_on_receipt_allocation
CREATE OR REPLACE FUNCTION public.update_contract_balance_on_receipt_allocation()
    RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
AS $$
begin
  insert into contract_balances (contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, company_id, updated_at)
  select c.id, c.tenant_id, c.unit_id,
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0)), 0),
    coalesce(sum(i.paid_amount), 0),
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - coalesce(i.paid_amount,0) - coalesce(i.credited_amount,0)), 0),
    c.company_id,
    now()
  from contracts c
  left join invoices i on i.contract_id = c.id and i.status != 'VOID' and i.deleted_at is null
  where c.id in (
    select distinct contract_id from invoices
    where id = coalesce(NEW.invoice_id, OLD.invoice_id)
  )
  group by c.id, c.tenant_id, c.unit_id, c.company_id
  on conflict (contract_id) do update set
    total_invoiced = excluded.total_invoiced,
    total_paid = excluded.total_paid,
    balance_due = excluded.balance_due,
    company_id = excluded.company_id,
    updated_at = now();
  return coalesce(NEW, OLD);
end;
$$;

-- Fix tenant balance to include credited_amount
CREATE OR REPLACE FUNCTION public.update_tenant_balance()
    RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_tenant_id uuid;
  v_company_id uuid;
begin
  if tg_op = 'DELETE' then
    v_company_id := old.company_id;
  else
    v_company_id := new.company_id;
  end if;

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
  elsif tg_table_name = 'invoice_credits' then
    if tg_op = 'DELETE' then
      select c.tenant_id into v_tenant_id
      from public.invoices i join public.contracts c on c.id = i.contract_id
      where i.id = old.invoice_id;
    else
      select c.tenant_id into v_tenant_id
      from public.invoices i join public.contracts c on c.id = i.contract_id
      where i.id = new.invoice_id;
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
    updated_at,
    company_id
  )
  select
    c.tenant_id,
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - coalesce(i.paid_amount,0) - coalesce(i.credited_amount,0)), 0),
    now(),
    v_company_id
  from public.contracts c
  left join public.invoices i
    on i.contract_id = c.id
   and i.deleted_at is null
  where c.tenant_id = v_tenant_id
    and c.company_id = v_company_id
    and (i.id is null or i.company_id = v_company_id)
  group by c.tenant_id
  on conflict (tenant_id) do update set
    balance_due = excluded.balance_due,
    company_id = excluded.company_id,
    updated_at = now();

  return coalesce(new, old);
end;
$$;

-- Fix recalculate_all_balances to include credited_amount and use canonical authority
CREATE OR REPLACE FUNCTION public.recalculate_all_balances()
    RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
AS $$
declare
  v_company_id uuid;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to recalculate balances' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  delete from public.contract_balances where company_id = v_company_id;
  insert into public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at, company_id
  )
  select
    c.id,
    c.tenant_id,
    c.unit_id,
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0)), 0),
    coalesce(sum(i.paid_amount), 0),
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - coalesce(i.paid_amount,0) - coalesce(i.credited_amount,0)), 0),
    now(),
    c.company_id
  from public.contracts c
  left join public.invoices i
    on i.contract_id = c.id
   and i.deleted_at is null
   and i.company_id = v_company_id
  where c.company_id = v_company_id
  group by c.id, c.tenant_id, c.unit_id, c.company_id;

  delete from public.tenant_balances where company_id = v_company_id;
  insert into public.tenant_balances (tenant_id, balance_due, updated_at, company_id)
  select
    c.tenant_id,
    coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - coalesce(i.paid_amount,0) - coalesce(i.credited_amount,0)), 0),
    now(),
    c.company_id
  from public.contracts c
  left join public.invoices i
    on i.contract_id = c.id
   and i.deleted_at is null
   and i.company_id = v_company_id
  where c.company_id = v_company_id
  group by c.tenant_id, c.company_id;

  delete from public.owner_balances where company_id = v_company_id;
  insert into public.owner_balances (
    owner_id, total_income, total_expenses, commission, net_balance, updated_at, company_id
  )
  select
    p.owner_id,
    coalesce(sum(case when i.deleted_at is null then i.paid_amount else 0 end), 0),
    coalesce((
      select sum(e.amount)
      from public.expenses e
      join public.units u2 on u2.id = e.property_id
      join public.properties p2 on p2.id = u2.property_id
      where p2.owner_id = p.owner_id
        and p2.company_id = v_company_id
        and e.company_id = v_company_id
        and e.deleted_at is null
    ), 0),
    0,
    0,
    now(),
    p.company_id
  from public.properties p
  join public.units u
    on u.property_id = p.id
   and u.company_id = v_company_id
  join public.contracts c
    on c.unit_id = u.id
   and c.company_id = v_company_id
  left join public.invoices i
    on i.contract_id = c.id
   and i.company_id = v_company_id
  where p.company_id = v_company_id
  group by p.owner_id, p.company_id;
end;
$$;

-- New: contract balance from invoice_credits
CREATE OR REPLACE FUNCTION public.update_contract_balance_from_credit()
    RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_invoice_id uuid;
  v_contract_id text;
  v_total_invoiced numeric;
  v_total_paid numeric;
  v_total_credited numeric;
  v_tenant_id text;
  v_unit_id text;
  v_company_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  SELECT c.id::text INTO v_contract_id
  FROM public.invoices i JOIN public.contracts c ON c.id = i.contract_id
  WHERE i.id = v_invoice_id;

  IF v_contract_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT 
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0)), 0),
    COALESCE(SUM(i.paid_amount), 0),
    COALESCE(SUM(i.credited_amount), 0),
    c.tenant_id::text,
    c.unit_id::text,
    c.company_id
  INTO v_total_invoiced, v_total_paid, v_total_credited, v_tenant_id, v_unit_id, v_company_id
  FROM public.contracts c
  LEFT JOIN public.invoices i ON i.contract_id::text = c.id::text AND i.deleted_at IS NULL
  WHERE c.id::text = v_contract_id::text
  GROUP BY c.tenant_id, c.unit_id, c.company_id;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at, company_id
  ) VALUES (
    v_contract_id::uuid,
    v_tenant_id::uuid,
    v_unit_id::uuid,
    v_total_invoiced,
    v_total_paid,
    v_total_invoiced - v_total_paid - v_total_credited,
    now(),
    v_company_id
  )
  ON CONFLICT (contract_id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    unit_id = EXCLUDED.unit_id,
    total_invoiced = EXCLUDED.total_invoiced,
    total_paid = EXCLUDED.total_paid,
    balance_due = EXCLUDED.balance_due,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_tenant_balance_from_credit()
    RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_invoice_id uuid;
  v_tenant_id uuid;
  v_company_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
    v_company_id := OLD.company_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
    v_company_id := NEW.company_id;
  END IF;

  SELECT c.tenant_id INTO v_tenant_id
  FROM public.invoices i JOIN public.contracts c ON c.id = i.contract_id
  WHERE i.id = v_invoice_id;

  IF v_tenant_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.tenant_balances (
    tenant_id,
    balance_due,
    updated_at,
    company_id
  )
  SELECT
    c.tenant_id,
    COALESCE(SUM(i.amount + COALESCE(i.tax_amount, 0) - COALESCE(i.paid_amount,0) - COALESCE(i.credited_amount,0)), 0),
    now(),
    v_company_id
  FROM public.contracts c
  LEFT JOIN public.invoices i
    ON i.contract_id = c.id
   AND i.deleted_at IS NULL
  WHERE c.tenant_id = v_tenant_id
    AND c.company_id = v_company_id
    AND (i.id IS NULL OR i.company_id = v_company_id)
  GROUP BY c.tenant_id
  ON CONFLICT (tenant_id) DO UPDATE SET
    balance_due = EXCLUDED.balance_due,
    company_id = EXCLUDED.company_id,
    updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Ensure missing tenant balance triggers exist
DROP TRIGGER IF EXISTS trg_invoices_update_tenant_balance ON public.invoices;
CREATE TRIGGER trg_invoices_update_tenant_balance
AFTER INSERT OR DELETE OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.update_tenant_balance();

DROP TRIGGER IF EXISTS trg_receipt_allocations_update_tenant_balance ON public.receipt_allocations;
CREATE TRIGGER trg_receipt_allocations_update_tenant_balance
AFTER INSERT OR DELETE ON public.receipt_allocations
FOR EACH ROW EXECUTE FUNCTION public.update_tenant_balance();

DROP TRIGGER IF EXISTS trg_invoice_credits_update_contract_balance ON public.invoice_credits;
CREATE TRIGGER trg_invoice_credits_update_contract_balance
AFTER INSERT OR DELETE OR UPDATE ON public.invoice_credits
FOR EACH ROW EXECUTE FUNCTION public.update_contract_balance_from_credit();

DROP TRIGGER IF EXISTS trg_invoice_credits_update_tenant_balance ON public.invoice_credits;
CREATE TRIGGER trg_invoice_credits_update_tenant_balance
AFTER INSERT OR DELETE OR UPDATE ON public.invoice_credits
FOR EACH ROW EXECUTE FUNCTION public.update_tenant_balance_from_credit();

-- Harden ACLs for trigger helpers (must be service_role only)
REVOKE ALL ON FUNCTION public.update_contract_balance_from_allocation() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.update_contract_balance_from_allocation() TO service_role;

REVOKE ALL ON FUNCTION public.update_contract_balance_from_invoice() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.update_contract_balance_from_invoice() TO service_role;

REVOKE ALL ON FUNCTION public.update_contract_balance_on_invoice() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.update_contract_balance_on_invoice() TO service_role;

REVOKE ALL ON FUNCTION public.update_contract_balance_on_receipt_allocation() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.update_contract_balance_on_receipt_allocation() TO service_role;

REVOKE ALL ON FUNCTION public.update_tenant_balance() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.update_tenant_balance() TO service_role;

REVOKE ALL ON FUNCTION public.update_contract_balance_from_credit() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.update_contract_balance_from_credit() TO service_role;

REVOKE ALL ON FUNCTION public.update_tenant_balance_from_credit() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.update_tenant_balance_from_credit() TO service_role;

REVOKE ALL ON FUNCTION public.recalculate_all_balances() FROM PUBLIC;
GRANT ALL ON FUNCTION public.recalculate_all_balances() TO authenticated, service_role;

-- Additional guard: ensure receipt void never deletes history (already append-only)
COMMENT ON FUNCTION public.update_tenant_balance() IS 'Group3 fix: includes credited_amount and handles invoice_credits; preserves tenant balance truth after credit/void.';
COMMENT ON FUNCTION public.update_contract_balance_from_invoice() IS 'Group3 fix: balance_due = invoiced - paid - credited; preserves contract balance truth.';
COMMENT ON FUNCTION public.recalculate_all_balances() IS 'Group3 fix: uses canonical is_admin_or_manager() and includes credited_amount; preserves balances truth.';
