-- ============================================================================
-- PHASE 1 — Canonical Financial Posting Convergence: exact OMR 3dp precision
-- ============================================================================
-- Mission: Malik Financial Hardening, Phase 1.
-- Audit: docs/audits/FINANCIAL_HARDENING_AUDIT_20260815.md (F10, F34).
--
-- Repository reality confirmed during investigation:
--   * The live collection path ALREADY converges on the canonical ledger:
--       record_invoice_payment_atomic -> post_receipt_atomic -> post_journal_event
--         -> journal_batches / journal_lines.
--   * journal_entries is a compatibility VIEW (not a table) over journal_lines +
--     journal_batches, and its INSTEAD-OF trigger (journal_entries_view_insert)
--     blocks browser writes (JOURNAL_ENTRIES_BROWSER_WRITE_BLOCKED) and routes
--     legacy business-RPC INSERTs into canonical journal_batches with idempotent
--     event keys (is_legacy_compat = true). So there is no separate legacy
--     accounting STORAGE; all live financial events land in journal_batches.
--
-- The genuine remaining Phase 1 defect is OMR precision: the authoritative
-- tenant-receivable / collection / expense surfaces were numeric(14,2) while
-- the canonical GL (journal_lines) and deposits are numeric(18,3). This
-- migration widens every authoritative OMR money column on the live AR/
-- collection/expense path to numeric(18,3) so a value such as 0.125 OMR is
-- representable and never silently truncated, and so subledger <-> GL
-- reconciliation at 0.001 tolerance is meaningful.
--
-- Widening numeric(14,2) -> numeric(18,3) is a safe, value-preserving
-- conversion (no existing value loses precision; scale is widened).
-- ----------------------------------------------------------------------------

begin;

-- ---------------------------------------------------------------------------
-- 0. Preserve security_invoker analysis views that project the widened money
--    columns. PostgreSQL refuses to alter a column type used by a view, so the
--    views are captured verbatim (pg_get_viewdef), dropped, the columns
--    widened, and the views recreated with the exact same security posture.
-- ---------------------------------------------------------------------------
do $preserve_views$
declare
  v_reconcile_view text;
  v_drift_view text;
  v_retro_view text;
begin
  if to_regclass('public.v_balance_reconciliation') is not null then
    select pg_get_viewdef('public.v_balance_reconciliation'::regclass, true)
      into v_reconcile_view;
  end if;
  if to_regclass('public.v_balance_reconciliation_drift') is not null then
    select pg_get_viewdef('public.v_balance_reconciliation_drift'::regclass, true)
      into v_drift_view;
  end if;
  if to_regclass('public.s08_retroactive_version_differences') is not null then
    select pg_get_viewdef('public.s08_retroactive_version_differences'::regclass, true)
      into v_retro_view;
  end if;

  -- Drop dependents first (drift selects from the base reconciliation view).
  drop view if exists public.v_balance_reconciliation_drift;
  drop view if exists public.v_balance_reconciliation;
  drop view if exists public.s08_retroactive_version_differences;

  alter table public.contracts
    alter column rent_amount type numeric(18,3) using rent_amount::numeric(18,3);
  alter table public.invoices
    alter column amount type numeric(18,3) using amount::numeric(18,3),
    alter column paid_amount type numeric(18,3) using paid_amount::numeric(18,3),
    alter column tax_amount type numeric(18,3) using tax_amount::numeric(18,3);
  alter table public.payments
    alter column amount type numeric(18,3) using amount::numeric(18,3);
  alter table public.receipts
    alter column amount type numeric(18,3) using amount::numeric(18,3);
  alter table public.receipt_allocations
    alter column amount type numeric(18,3) using amount::numeric(18,3);
  alter table public.expenses
    alter column amount type numeric(18,3) using amount::numeric(18,3);

  -- Recreate in dependency order: base, then drift.
  if v_reconcile_view is not null then
    execute 'create view public.v_balance_reconciliation with (security_invoker = true) as ' || v_reconcile_view;
  end if;
  if v_drift_view is not null then
    execute 'create view public.v_balance_reconciliation_drift with (security_invoker = true) as ' || v_drift_view;
  end if;
  if v_retro_view is not null then
    execute 'create view public.s08_retroactive_version_differences with (security_invoker = true) as ' || v_retro_view;
  end if;
end;
$preserve_views$;

-- ---------------------------------------------------------------------------
-- 5. Server-side OMR rounding fix in recurring invoice generation.
--    The tax amount was rounded to 2 decimal places; must be 3dp to match the
--    authoritative OMR precision and to keep the posted invoice DR line
--    (amount + tax) balanced with its CR lines at 3dp.
-- ---------------------------------------------------------------------------
create or replace function public.generate_invoices_from_active_contracts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_company_id uuid;
  v_contract record;
  v_invoice_id uuid;
  v_batch_id uuid;
  v_tax_rate numeric;
  v_tax_amount numeric;
  v_total_amount numeric;
  v_ar_account_id text;
  v_revenue_account_id text;
  v_vat_account_id text;
  v_count integer := 0;
  v_period_start date;
  v_period_end date;
  v_invoice_exists boolean;
  v_lines jsonb;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role is required to generate invoices' using errcode = '42501';
  end if;
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;
  if v_company_id is null then
    raise exception 'Company context is required (no company_id claim in JWT).' using errcode = '42501';
  end if;
  v_ar_account_id := public.require_company_account_id(v_company_id, '1201');
  v_revenue_account_id := public.require_company_account_id(v_company_id, '4000');
  select case when vat_enabled then coalesce(vat_rate, 0) else 0 end
    into v_tax_rate
    from public.company_settings
    where company_id = v_company_id
    limit 1;
  if v_tax_rate is null then
    v_tax_rate := 0;
  end if;
  if v_tax_rate > 0 then
    v_vat_account_id := public.require_company_account_id(v_company_id, '2100');
  end if;
  for v_contract in
    select c.id, c.rent_amount, c.payment_cycle, c.start_date
    from public.contracts c
    where c.deleted_at is null
      and lower(c.status) = 'active'
      and c.company_id = v_company_id
    order by c.id
  loop
    perform pg_advisory_xact_lock(hashtext('invoice_generation:' || v_contract.id::text));
    case v_contract.payment_cycle
      when 'monthly' then
        v_period_start := date_trunc('month', current_date)::date;
        v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
      when 'quarterly' then
        v_period_start := date_trunc('quarter', current_date)::date;
        v_period_end := (date_trunc('quarter', current_date) + interval '3 months' - interval '1 day')::date;
      when 'semi_annual' then
        if extract(month from current_date) <= 6 then
          v_period_start := make_date(extract(year from current_date)::int, 1, 1);
          v_period_end := make_date(extract(year from current_date)::int, 6, 30);
        else
          v_period_start := make_date(extract(year from current_date)::int, 7, 1);
          v_period_end := make_date(extract(year from current_date)::int, 12, 31);
        end if;
      when 'annual' then
        v_period_start := date_trunc('year', current_date)::date;
        v_period_end := (date_trunc('year', current_date) + interval '1 year' - interval '1 day')::date;
      else
        v_period_start := date_trunc('month', current_date)::date;
        v_period_end := (date_trunc('month', current_date) + interval '1 month' - interval '1 day')::date;
    end case;
    select exists(
      select 1 from public.invoices i
      where i.contract_id = v_contract.id
        and i.issue_date >= v_period_start
        and i.issue_date <= v_period_end
        and i.deleted_at is null
    ) into v_invoice_exists;
    if v_invoice_exists then
      continue;
    end if;
    -- Authoritative OMR 3dp: tax is rounded to three decimals, not two.
    v_tax_amount := round(v_contract.rent_amount * v_tax_rate / 100, 3);
    v_total_amount := v_contract.rent_amount + v_tax_amount;
    insert into public.invoices (
      contract_id, issue_date, due_date, amount, tax_amount, tax_rate, status
    , company_id) values (
      v_contract.id,
      current_date,
      current_date + interval '30 days',
      v_contract.rent_amount,
      v_tax_amount,
      v_tax_rate,
      'UNPAID'
    , v_company_id)
    returning id into v_invoice_id;
    -- Post the invoice journal through the canonical posting engine.
    v_lines := jsonb_build_array(
      jsonb_build_object(
        'account_id', v_ar_account_id,
        'debit', v_total_amount,
        'credit', 0,
        'line_description', 'INV-' || v_invoice_id::text || '-DR',
        'ref_source_id', v_invoice_id::text,
        'ref_entity_type', 'invoice',
        'ref_entity_id', v_invoice_id::text
      ),
      jsonb_build_object(
        'account_id', v_revenue_account_id,
        'debit', 0,
        'credit', v_contract.rent_amount,
        'line_description', 'INV-' || v_invoice_id::text || '-CR-REV',
        'ref_source_id', v_invoice_id::text,
        'ref_entity_type', 'invoice',
        'ref_entity_id', v_invoice_id::text
      )
    );
    if v_tax_amount > 0 and v_vat_account_id is not null then
      v_lines := v_lines || jsonb_build_object(
        'account_id', v_vat_account_id,
        'debit', 0,
        'credit', v_tax_amount,
        'line_description', 'INV-' || v_invoice_id::text || '-CR-VAT',
        'ref_source_id', v_invoice_id::text,
        'ref_entity_type', 'invoice',
        'ref_entity_id', v_invoice_id::text
      );
    end if;
    -- Ensure an open accounting period exists for the invoice effective date.
    perform public.gl_ensure_initial_open_period(v_company_id, current_date);
    perform public.post_journal_event(jsonb_build_object(
      'company_id', v_company_id,
      'source_type', 'invoice',
      'source_id', v_invoice_id::text,
      'event_id', v_invoice_id::text,
      'effective_date', current_date,
      'description', 'Rent invoice ' || v_invoice_id::text,
      'lines', v_lines
    ));
    v_count := v_count + 1;
  end loop;
  if v_count > 0 then
    insert into public.audit_log (
      id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
    ) values (
      gen_random_uuid()::text,
      extract(epoch from now())::bigint,
      auth.uid(),
      (select email from auth.users where id = auth.uid()),
      'GENERATE',
      'invoices',
      'batch',
      format('Generated %s invoices from active contracts', v_count),
      'invoices',
      jsonb_build_object('count', v_count, 'tax_rate', v_tax_rate)::text,
      now()
    );
  end if;
  return v_count;
end;
$function$;

-- Preserve server-side authority posture for the rewritten function.
alter function public.generate_invoices_from_active_contracts() owner to postgres;
alter function public.generate_invoices_from_active_contracts()
  set search_path = public, pg_temp;

-- ---------------------------------------------------------------------------
-- 6. OMR 3dp invariant enforcement (defense-in-depth).
--    numeric(18,3) already rounds to 3 decimals on store; these checks make the
--    exact-money invariant explicit and catch any future narrower/careless write.
--    They are trivially satisfied by the widened column types.
-- ---------------------------------------------------------------------------
alter table public.invoices
  drop constraint if exists invoices_amount_omr3dp_check;
alter table public.invoices
  add constraint invoices_amount_omr3dp_check check (amount = round(amount, 3));
alter table public.invoices
  drop constraint if exists invoices_paid_amount_omr3dp_check;
alter table public.invoices
  add constraint invoices_paid_amount_omr3dp_check check (paid_amount = round(paid_amount, 3));
alter table public.invoices
  drop constraint if exists invoices_tax_amount_omr3dp_check;
alter table public.invoices
  add constraint invoices_tax_amount_omr3dp_check check (tax_amount = round(tax_amount, 3));

alter table public.payments
  drop constraint if exists payments_amount_omr3dp_check;
alter table public.payments
  add constraint payments_amount_omr3dp_check check (amount = round(amount, 3));

alter table public.receipts
  drop constraint if exists receipts_amount_omr3dp_check;
alter table public.receipts
  add constraint receipts_amount_omr3dp_check check (amount = round(amount, 3));

alter table public.receipt_allocations
  drop constraint if exists receipt_allocations_amount_omr3dp_check;
alter table public.receipt_allocations
  add constraint receipt_allocations_amount_omr3dp_check check (amount = round(amount, 3));

alter table public.expenses
  drop constraint if exists expenses_amount_omr3dp_check;
alter table public.expenses
  add constraint expenses_amount_omr3dp_check check (amount = round(amount, 3));

alter table public.contracts
  drop constraint if exists contracts_rent_amount_omr3dp_check;
alter table public.contracts
  add constraint contracts_rent_amount_omr3dp_check check (rent_amount = round(rent_amount, 3));

-- ---------------------------------------------------------------------------
-- 7. Post-conditions: verify every authoritative money column is now 3dp.
-- ---------------------------------------------------------------------------
do $verify$
declare
  v_bad integer;
begin
  select count(*) into v_bad
    from information_schema.columns
   where table_schema = 'public'
     and (
        (table_name = 'contracts'      and column_name = 'rent_amount')
        or (table_name = 'invoices'    and column_name in ('amount','paid_amount','tax_amount'))
        or (table_name = 'payments'    and column_name = 'amount')
        or (table_name = 'receipts'    and column_name = 'amount')
        or (table_name = 'receipt_allocations' and column_name = 'amount')
        or (table_name = 'expenses'    and column_name = 'amount')
     )
     and not (numeric_precision = 18 and numeric_scale = 3);
  if v_bad <> 0 then
    raise exception 'PHASE1_OMR_PRECISION_VERIFY_FAILED: % money column(s) not widened to numeric(18,3).', v_bad;
  end if;
end;
$verify$;

commit;
