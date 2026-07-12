-- Consolidated production baseline: reports, views, and indexes

begin;

create or replace view public.v_balance_reconciliation
with (security_invoker = true)
as
select
  c.id as contract_id,
  c.property_id,
  c.unit_id,
  c.tenant_id,
  coalesce(sum(i.amount + coalesce(i.tax_amount, 0)) filter (where i.deleted_at is null and i.status <> 'VOID'), 0) as invoiced_amount,
  coalesce(sum(i.paid_amount) filter (where i.deleted_at is null and i.status <> 'VOID'), 0) as invoice_paid_amount,
  coalesce(sum(p.amount) filter (where p.deleted_at is null and coalesce(p.status, 'POSTED') <> 'VOID'), 0) as posted_payment_amount,
  coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - i.paid_amount) filter (where i.deleted_at is null and i.status <> 'VOID'), 0) as outstanding_amount,
  (
    coalesce(sum(i.paid_amount) filter (where i.deleted_at is null and i.status <> 'VOID'), 0)
    - coalesce(sum(p.amount) filter (where p.deleted_at is null and coalesce(p.status, 'POSTED') <> 'VOID'), 0)
  ) as paid_vs_payment_drift
from public.contracts c
left join public.invoices i on i.contract_id = c.id
left join public.payments p on p.contract_id = c.id
where c.deleted_at is null
group by c.id, c.property_id, c.unit_id, c.tenant_id;

create or replace view public.v_balance_reconciliation_drift
with (security_invoker = true)
as
select *
from public.v_balance_reconciliation
where abs(paid_vs_payment_drift) > 0.01;

CREATE OR REPLACE VIEW public.vw_active_owner_agreements AS
SELECT DISTINCT ON (property_id)
  id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on
FROM public.owner_agreements
WHERE ends_on IS NULL OR ends_on >= CURRENT_DATE
ORDER BY property_id, starts_on DESC;

create or replace function public.rpt_financial_summary(p_from date, p_to date)
returns table (
  collected numeric,
  expenses numeric,
  net numeric,
  revenue numeric,
  net_income numeric,
  overdue_amount numeric,
  overdue_count bigint,
  active_contracts bigint,
  total_units bigint,
  occupied_units bigint,
  occupancy_rate numeric,
  pending_invoices bigint,
  period_from date,
  period_to date
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with totals as (
    select
      coalesce((select sum(amount) from public.payments where deleted_at is null and payment_date between p_from and p_to and coalesce(status, 'POSTED') <> 'VOID'), 0) as collected,
      coalesce((select sum(amount) from public.expenses where deleted_at is null and expense_date between p_from and p_to), 0) as expenses,
      coalesce((select sum(amount + coalesce(tax_amount, 0)) from public.invoices where deleted_at is null and issue_date between p_from and p_to and upper(coalesce(status, '')) not in ('VOID', 'CANCELLED')), 0) as revenue,
      coalesce((select sum(amount + coalesce(tax_amount, 0) - paid_amount) from public.invoices where deleted_at is null and upper(coalesce(status, '')) not in ('VOID', 'CANCELLED') and upper(coalesce(status, '')) in ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE') and due_date < current_date), 0) as overdue_amount,
      coalesce((select count(*) from public.invoices where deleted_at is null and upper(coalesce(status, '')) not in ('VOID', 'CANCELLED') and upper(coalesce(status, '')) in ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE') and due_date < current_date), 0) as overdue_count,
      coalesce((select count(*) from public.contracts where deleted_at is null and lower(status) = 'active'), 0) as active_contracts,
      coalesce((select count(*) from public.units where deleted_at is null), 0) as total_units,
      coalesce((select count(*) from public.units where deleted_at is null and status = 'occupied'), 0) as occupied_units,
      coalesce((select count(*) from public.invoices where deleted_at is null and upper(coalesce(status, '')) not in ('VOID', 'CANCELLED') and upper(coalesce(status, '')) in ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')), 0) as pending_invoices
  )
  select
    collected,
    expenses,
    collected - expenses as net,
    revenue,
    collected - expenses as net_income,
    overdue_amount,
    overdue_count,
    active_contracts,
    total_units,
    occupied_units,
    case when total_units = 0 then 0 else round((occupied_units::numeric / total_units::numeric) * 100, 2) end as occupancy_rate,
    pending_invoices,
    p_from,
    p_to
  from totals
$$;

CREATE OR REPLACE FUNCTION public.rpt_dashboard_overview(
  p_from date,
  p_to date,
  p_as_of date DEFAULT current_date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_financial record;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_user(), false) THEN
    RAISE EXCEPTION 'Authenticated app user is required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_financial FROM public.rpt_financial_summary(p_from, p_to);

  SELECT jsonb_build_object(
    'financial', jsonb_build_object(
      'total_collected', coalesce(v_financial.collected, 0),
      'total_overdue_invoices', coalesce(v_financial.overdue_amount, 0),
      'total_expenses', coalesce(v_financial.expenses, 0),
      'net_revenue', coalesce(v_financial.net, 0)
    ),
    'operational', jsonb_build_object(
      'properties', (SELECT count(*) FROM public.properties WHERE deleted_at IS NULL),
      'units', (SELECT count(*) FROM public.units WHERE deleted_at IS NULL),
      'activeContracts', (SELECT count(*) FROM public.contracts WHERE deleted_at IS NULL AND status = 'ACTIVE'),
      'expiringContracts30Days', (
        SELECT count(*)
        FROM public.contracts
        WHERE deleted_at IS NULL
          AND status = 'ACTIVE'
          AND end_date >= p_as_of
          AND end_date <= (p_as_of + interval '30 days')::date
      ),
      'vacantUnits', (SELECT count(*) FROM public.units WHERE deleted_at IS NULL AND status = 'available'),
      'overdueInvoices', (SELECT count(*) FROM public.invoices WHERE deleted_at IS NULL AND status = 'OVERDUE')
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpt_daily_collection(p_from date, p_to date)
RETURNS TABLE(
  collection_date date,
  payment_method text,
  total_amount numeric,
  payments_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_app_user() THEN
    RAISE EXCEPTION 'Authenticated app user is required to run daily collection reports'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p.payment_date::date AS collection_date,
    COALESCE(NULLIF(p.payment_method, ''), 'other')::text AS payment_method,
    COALESCE(SUM(p.amount), 0)::numeric AS total_amount,
    COUNT(*)::bigint AS payments_count
  FROM public.payments p
  WHERE p.deleted_at IS NULL
    AND UPPER(COALESCE(p.status, 'POSTED')) <> 'VOID'
    AND p.payment_date::date BETWEEN p_from AND p_to
  GROUP BY p.payment_date::date, COALESCE(NULLIF(p.payment_method, ''), 'other')
  ORDER BY collection_date, payment_method;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpt_cash_flow(
  p_from_date date,
  p_to_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_operating jsonb;
  v_investing jsonb;
  v_financing jsonb;
  v_receipts numeric;
  v_expenses numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_receipts
  FROM public.payments
  WHERE payment_date BETWEEN p_from_date AND p_to_date
    AND deleted_at IS NULL
    AND UPPER(COALESCE(status, 'POSTED')) <> 'VOID';

  SELECT COALESCE(SUM(amount), 0) INTO v_expenses
  FROM public.expenses
  WHERE expense_date BETWEEN p_from_date AND p_to_date
    AND deleted_at IS NULL;

  v_operating := jsonb_build_object(
    'receipts', v_receipts,
    'expenses', v_expenses,
    'net_operating', v_receipts - v_expenses
  );

  v_investing := jsonb_build_object('note', 'not_applicable_single_office', 'amount', 0);
  v_financing := jsonb_build_object('note', 'not_applicable_single_office', 'amount', 0);

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', p_from_date, 'to', p_to_date),
    'operating', v_operating,
    'investing', v_investing,
    'financing', v_financing,
    'net_change', v_receipts - v_expenses
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpt_vat_return(
  p_from_date date,
  p_to_date date
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', p_from_date, 'to', p_to_date),
    'total_sales_amount', COALESCE(SUM(amount), 0),
    'total_tax_amount', COALESCE(SUM(tax_amount), 0),
    'invoice_count', COUNT(*)
  ) INTO v_result
  FROM public.invoices
  WHERE issue_date BETWEEN p_from_date AND p_to_date
    AND deleted_at IS NULL
    AND UPPER(COALESCE(status, '')) NOT IN ('VOID', 'CANCELLED');

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpt_owner_statement(p_owner_id uuid, p_from date, p_to date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      and pr.id in (select id from properties where owner_id = p_owner_id)
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

CREATE OR REPLACE FUNCTION public.rpt_trial_balance(p_as_of date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cash numeric := 0;
  v_ar numeric := 0;
  v_expenses numeric := 0;
  v_revenue numeric := 0;
  v_owner_pay numeric := 0;
  v_vat numeric := 0;
  v_retained numeric := 0;
  v_accounts jsonb;
  v_total_debits numeric := 0;
  v_total_credits numeric := 0;
BEGIN
  -- Cash on hand: posted, non-deleted payments received up to the as-of date.
  SELECT COALESCE(SUM(amount), 0)
    INTO v_cash
    FROM public.payments
   WHERE deleted_at IS NULL
     AND (status IS NULL OR upper(status) <> 'VOID')
     AND payment_date <= p_as_of;

  -- Tenant receivables: open (unpaid) invoice principal + tax up to the as-of date.
  SELECT COALESCE(SUM(GREATEST(amount + COALESCE(tax_amount, 0) - COALESCE(paid_amount, 0), 0)), 0)
    INTO v_ar
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  -- Operating expenses incurred up to the as-of date.
  SELECT COALESCE(SUM(amount), 0)
    INTO v_expenses
    FROM public.expenses
   WHERE deleted_at IS NULL
     AND expense_date <= p_as_of;

  -- Rental revenue invoiced up to the as-of date.
  SELECT COALESCE(SUM(amount), 0)
    INTO v_revenue
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  -- Owner payables recorded up to the as-of date (settlements not cancelled).
  SELECT COALESCE(SUM(amount), 0)
    INTO v_owner_pay
    FROM public.owner_settlements
   WHERE (status IS NULL OR status <> 'CANCELLED')
     AND date <= p_as_of;

  -- VAT payable on invoiced revenue up to the as-of date.
  SELECT COALESCE(SUM(COALESCE(tax_amount, 0)), 0)
    INTO v_vat
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  -- Retained earnings is the balancing figure so debits == credits.
  v_retained := v_cash + v_ar + v_expenses - v_revenue - v_owner_pay - v_vat;

  v_accounts := jsonb_build_array(
    jsonb_build_object('code', '1111', 'name', 'Cash', 'type', 'asset', 'balance_type', 'debit', 'balance', round(v_cash, 2)),
    jsonb_build_object('code', '1201', 'name', 'Tenant Receivables', 'type', 'asset', 'balance_type', 'debit', 'balance', round(v_ar, 2)),
    jsonb_build_object('code', '6100', 'name', 'Operating Expenses', 'type', 'expense', 'balance_type', 'debit', 'balance', round(v_expenses, 2)),
    jsonb_build_object('code', '4000', 'name', 'Rental Revenue', 'type', 'revenue', 'balance_type', 'credit', 'balance', round(v_revenue, 2)),
    jsonb_build_object('code', '2000', 'name', 'Owner Payables', 'type', 'liability', 'balance_type', 'credit', 'balance', round(v_owner_pay, 2)),
    jsonb_build_object('code', '2100', 'name', 'VAT Payable', 'type', 'liability', 'balance_type', 'credit', 'balance', round(v_vat, 2)),
    jsonb_build_object('code', '3000', 'name', 'Retained Earnings', 'type', 'equity', 'balance_type', 'credit', 'balance', round(v_retained, 2))
  );

  v_total_debits := round(v_cash + v_ar + v_expenses, 2);
  v_total_credits := round(v_revenue + v_owner_pay + v_vat + v_retained, 2);

  RETURN jsonb_build_object(
    'as_of', p_as_of,
    'accounts', v_accounts,
    'total_debits', v_total_debits,
    'total_credits', v_total_credits,
    'is_balanced', (v_total_debits = v_total_credits)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpt_income_statement(p_from date, p_to date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_revenue numeric := 0;
  v_expenses numeric := 0;
  v_net numeric := 0;
  v_revenue_rows jsonb;
  v_expense_rows jsonb;
BEGIN
  -- Rental / operational revenue invoiced in the period (excludes voided and deleted).
  SELECT COALESCE(SUM(amount), 0)
    INTO v_revenue
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date BETWEEN p_from AND p_to;

  -- Operating expenses incurred in the period, broken down by category.
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('label', category, 'amount', round(amount, 2)) ORDER BY category),
    '[]'::jsonb
  )
    INTO v_expense_rows
    FROM (
      SELECT category, SUM(amount) AS amount
        FROM public.expenses
       WHERE deleted_at IS NULL
         AND expense_date BETWEEN p_from AND p_to
       GROUP BY category
    ) s;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_expenses
    FROM public.expenses
   WHERE deleted_at IS NULL
     AND expense_date BETWEEN p_from AND p_to;

  v_net := round(v_revenue - v_expenses, 2);

  v_revenue_rows := jsonb_build_array(
    jsonb_build_object('label', 'الإيرادات التشغيلية', 'amount', round(v_revenue, 2))
  );

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'revenue', v_revenue_rows,
    'total_revenue', round(v_revenue, 2),
    'expenses', v_expense_rows,
    'total_expenses', round(v_expenses, 2),
    'net_income', v_net
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpt_balance_sheet(p_as_of date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cash numeric := 0;
  v_ar numeric := 0;
  v_owner_pay numeric := 0;
  v_vat numeric := 0;
  v_assets numeric := 0;
  v_liabilities numeric := 0;
  v_equity numeric := 0;
  v_asset_rows jsonb;
  v_liability_rows jsonb;
  v_equity_rows jsonb;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
    INTO v_cash
    FROM public.payments
   WHERE deleted_at IS NULL
     AND (status IS NULL OR upper(status) <> 'VOID')
     AND payment_date <= p_as_of;

  SELECT COALESCE(SUM(GREATEST(amount + COALESCE(tax_amount, 0) - COALESCE(paid_amount, 0), 0)), 0)
    INTO v_ar
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  SELECT COALESCE(SUM(amount), 0)
    INTO v_owner_pay
    FROM public.owner_settlements
   WHERE (status IS NULL OR status <> 'CANCELLED')
     AND date <= p_as_of;

  SELECT COALESCE(SUM(COALESCE(tax_amount, 0)), 0)
    INTO v_vat
    FROM public.invoices
   WHERE deleted_at IS NULL
     AND (status IS NULL OR lower(status) <> 'void')
     AND issue_date <= p_as_of;

  v_assets := round(v_cash + v_ar, 2);
  v_liabilities := round(v_owner_pay + v_vat, 2);
  v_equity := round(v_assets - v_liabilities, 2);

  v_asset_rows := jsonb_build_array(
    jsonb_build_object('code', '1111', 'name', 'Cash', 'amount', round(v_cash, 2)),
    jsonb_build_object('code', '1201', 'name', 'Tenant Receivables', 'amount', round(v_ar, 2))
  );
  v_liability_rows := jsonb_build_array(
    jsonb_build_object('code', '2000', 'name', 'Owner Payables', 'amount', round(v_owner_pay, 2)),
    jsonb_build_object('code', '2100', 'name', 'VAT Payable', 'amount', round(v_vat, 2))
  );
  v_equity_rows := jsonb_build_array(
    jsonb_build_object('code', '3000', 'name', 'Retained Earnings', 'amount', round(v_equity, 2))
  );

  RETURN jsonb_build_object(
    'as_of', p_as_of,
    'assets', v_asset_rows,
    'total_assets', v_assets,
    'liabilities', v_liability_rows,
    'total_liabilities', v_liabilities,
    'equity', v_equity_rows,
    'total_equity', v_equity,
    'is_balanced', (v_assets = (v_liabilities + v_equity))
  );
END;
$$;

create index audit_log_created_idx on public.audit_log (created_at desc);

create index if not exists communication_records_active_idx
  on public.communication_records (status, channel, created_at desc)
  where deleted_at is null;

create index if not exists communication_records_related_idx
  on public.communication_records (related_entity_type, related_entity_id)
  where related_entity_type is not null and related_entity_id is not null;

create index if not exists contract_documents_contract_idx
  on public.contract_documents (contract_id, created_at desc)
  where deleted_at is null;

create index contracts_active_unit_idx on public.contracts (unit_id, start_date, end_date) where deleted_at is null and lower(status) = 'active';

CREATE INDEX IF NOT EXISTS contracts_agreement_id_idx
  ON public.contracts (agreement_id);

create index contracts_property_idx on public.contracts (property_id, created_at desc) where deleted_at is null;

create index contracts_tenant_idx on public.contracts (tenant_id) where deleted_at is null;

create index contracts_unit_idx on public.contracts (unit_id) where deleted_at is null;

create index expenses_property_date_idx on public.expenses (property_id, expense_date desc) where deleted_at is null;

create index expenses_report_date_idx on public.expenses (expense_date, property_id, category) where deleted_at is null;

create index if not exists idx_automation_run_logs_job_id on public.automation_run_logs (job_id);

create index if not exists idx_automation_runs_job_id on public.automation_runs (job_id);

create index if not exists idx_bank_accounts_active on public.bank_accounts (is_active) where deleted_at is null;

create index if not exists idx_bank_reconciliation_matches_entity on public.bank_reconciliation_matches (matched_entity_type, matched_entity_id);

create index if not exists idx_bank_statement_imports_account on public.bank_statement_imports (bank_account_id, imported_at desc) where deleted_at is null;

create index if not exists idx_bank_statement_lines_account_date on public.bank_statement_lines (bank_account_id, transaction_date desc) where deleted_at is null;

CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_import_id
  ON public.bank_statement_lines(import_id);

create index if not exists idx_bank_statement_lines_status on public.bank_statement_lines (status) where deleted_at is null;

CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_status_date
  ON public.bank_statement_lines(status, transaction_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_payment_terms_id ON public.contracts(payment_terms_id);

CREATE INDEX IF NOT EXISTS idx_cost_centers_parent_id ON public.cost_centers(parent_id);

CREATE INDEX IF NOT EXISTS idx_cost_centers_property_id ON public.cost_centers(property_id);

create index if not exists idx_deposit_txs_contract_id on public.deposit_txs (contract_id);

CREATE INDEX IF NOT EXISTS idx_expenses_cost_center_id ON public.expenses(cost_center_id);

CREATE INDEX IF NOT EXISTS idx_invoices_report_due_status
  ON public.invoices(due_date, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_journal_entries_cost_center_id ON public.journal_entries(cost_center_id);

create index if not exists idx_notifications_user_read on public.notifications (user_id, is_read);

create index if not exists idx_outgoing_notifications_status
  on public.outgoing_notifications (status, created_at) where (deleted_at is null);

create index if not exists idx_outgoing_notifications_status_created_at
  on public.outgoing_notifications (status, created_at);

CREATE INDEX IF NOT EXISTS idx_owner_agreements_owner_id
  ON public.owner_agreements(owner_id);

CREATE INDEX IF NOT EXISTS idx_payments_report_date_status
  ON public.payments(payment_date, status)
  WHERE deleted_at IS NULL;

create index if not exists idx_profiles_auth_user_id on public.profiles (auth_user_id);

create index if not exists idx_sessions_user_id on public.sessions (user_id);

create index if not exists idx_status_history_actor_id on public.status_history (actor_id);

CREATE INDEX IF NOT EXISTS idx_tenant_balances_tenant_id ON public.tenant_balances (tenant_id);

create index if not exists idx_tenants_status on public.tenants (status) where (archived_at is null);

create index if not exists idx_tenants_unit_id on public.tenants (unit_id);

create index invoices_contract_idx on public.invoices (contract_id, due_date desc) where deleted_at is null;

create index invoices_contract_status_due_idx on public.invoices (contract_id, status, due_date) where deleted_at is null;

create index invoices_due_overdue_idx on public.invoices (due_date) where deleted_at is null and status in ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE');

create index invoices_status_issue_idx on public.invoices (status, issue_date) where deleted_at is null;

create index journal_entries_source_idx on public.journal_entries (source_id, entity_type);

create index maintenance_property_idx on public.maintenance_records (property_id, created_at desc) where deleted_at is null;

create index maintenance_unit_idx on public.maintenance_records (unit_id, created_at desc) where deleted_at is null;

CREATE INDEX IF NOT EXISTS owner_agreements_property_range_idx
  ON public.owner_agreements (property_id, starts_on, ends_on);

create index payments_contract_idx on public.payments (contract_id, payment_date desc) where deleted_at is null;

create index payments_invoice_idx on public.payments (invoice_id, payment_date desc) where deleted_at is null;

create index payments_report_date_idx on public.payments (payment_date, invoice_id, contract_id) where deleted_at is null;

create index people_type_idx on public.people (type, created_at desc) where deleted_at is null;

create index properties_active_idx on public.properties (created_at desc) where deleted_at is null;

create index properties_search_idx on public.properties using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(address, '') || ' ' || coalesce(owner_name, '')));

create unique index property_owners_active_primary_unique_idx
  on public.property_owners (property_id)
  where ends_on is null and is_primary;

create index property_owners_owner_idx on public.property_owners (owner_id, ends_on);

create index property_owners_property_idx on public.property_owners (property_id, ends_on);

create index receipt_allocations_invoice_idx on public.receipt_allocations (invoice_id);

create index receipts_contract_idx on public.receipts (contract_id, date_time desc) where deleted_at is null;

create index receipts_request_id_idx on public.receipts (request_id) where request_id is not null;

create index units_property_idx on public.units (property_id, unit_number) where deleted_at is null;

grant select on public.v_balance_reconciliation to authenticated;
grant select on public.v_balance_reconciliation_drift to authenticated;
revoke all on function public.rpt_financial_summary(date, date) from public, anon;
grant execute on function public.rpt_financial_summary(date, date) to authenticated;
revoke all on function public.rpt_daily_collection(date, date) from public, anon;
grant execute on function public.rpt_daily_collection(date, date) to authenticated, service_role;
revoke all on function public.rpt_cash_flow(date, date) from public, anon;
grant execute on function public.rpt_cash_flow(date, date) to authenticated, service_role;
revoke all on function public.rpt_vat_return(date, date) from public, anon;
grant execute on function public.rpt_vat_return(date, date) to authenticated, service_role;
revoke all on function public.rpt_trial_balance(date) from public, anon;
grant execute on function public.rpt_trial_balance(date) to authenticated, service_role;
revoke all on function public.rpt_income_statement(date, date) from public, anon;
grant execute on function public.rpt_income_statement(date, date) to authenticated, service_role;
revoke all on function public.rpt_balance_sheet(date) from public, anon;
grant execute on function public.rpt_balance_sheet(date) to authenticated, service_role;
revoke all on function public.rpt_dashboard_overview(date,date,date) from public, anon;
grant execute on function public.rpt_dashboard_overview(date,date,date) to authenticated, service_role;
alter function public.rpt_cash_flow(date,date) owner to postgres;
alter function public.rpt_vat_return(date,date) owner to postgres;
alter function public.rpt_dashboard_overview(date,date,date) owner to postgres;

commit;
