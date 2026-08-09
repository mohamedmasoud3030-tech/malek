-- =============================================================================
-- Stage S04 — property_management and Financial Lifecycle GL posting RPCs
--
-- ADR: docs/adr/0010-accounting-legal-reference.md
-- Governance: governance/canonical-business-rules.json
--   operating_model: OWNER_AGENCY (AGENT_NET)
--   collection_roles: OWNER_IS_CREDITOR (default), OFFICE_IS_CREDITOR (explicit)
--   commission_recognition_basis: RATE→ON_COLLECTION, FIXED_MONTHLY→DAILY_ACCRUAL
--   currency: OMR, precision: 3 decimal places
--
-- This migration adds server-side atomic RPCs for the property_management
-- (AGENT_NET) accounting model, expenses, deposits, commissions, reconciliation
-- and diagnostic integrity audits.
-- All write RPCs post via post_journal_event() and are accessible only to
-- service_role — the browser cannot post free-form journals.
--
-- No historical data is touched destructively. Forward-only.
-- Rollback: supabase/rollback/20260809010000_rollback_s04_property_management_gl_rpcs.sql
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: resolve required account_id for a company + account_no.
-- Returns text matching accounts.id / journal_lines.account_id.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_require_account(
  p_company_id uuid,
  p_account_no  text
)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $fn$
declare
  v_id text;
begin
  select id into v_id
    from public.accounts
   where company_id = p_company_id
     and no = p_account_no
     and is_active = true
   limit 1;

  if v_id is null then
    raise exception 'GL_PM_ACCOUNT_NOT_FOUND: account % not provisioned or inactive for company %. Run ensure_company_chart_of_accounts first.',
      p_account_no, p_company_id
      using errcode = 'P0002';
  end if;

  return v_id;
end;
$fn$;

alter function public.gl_pm_require_account(uuid, text) owner to postgres;
revoke all on function public.gl_pm_require_account(uuid, text) from public, anon, authenticated;
grant execute on function public.gl_pm_require_account(uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: OMR rounding to 3 decimal places (server-side, canonical).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_round_omr(p_amount numeric)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select round(p_amount, 3);
$fn$;

alter function public.gl_pm_round_omr(numeric) owner to postgres;
revoke all on function public.gl_pm_round_omr(numeric) from public, anon, authenticated;
grant execute on function public.gl_pm_round_omr(numeric) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 1: gl_pm_post_collection_owner_is_creditor
--
-- OWNER_AGENCY / OWNER_IS_CREDITOR / RATE / ON_COLLECTION
--
-- Entries posted (OMR, 3dp):
--   Dr  1120 Bank (or 1111 Cash)         collected_amount
--     Cr  2000 Owner Funds Payable        collected_amount
--   [split commission from OFP:]
--   Dr  2000 Owner Funds Payable          commission_gross
--     Cr  4100 Management Fee Revenue     commission_net
--     Cr  2100 VAT Payable                vat_amount
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_post_collection_owner_is_creditor(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_company_id       uuid    := (p_payload->>'company_id')::uuid;
  v_payment_id       uuid    := (p_payload->>'payment_id')::uuid;
  v_collected        numeric := public.gl_pm_round_omr((p_payload->>'collected_amount')::numeric);
  v_commission_net   numeric := public.gl_pm_round_omr((p_payload->>'commission_net')::numeric);
  v_vat_amount       numeric := public.gl_pm_round_omr(coalesce((p_payload->>'vat_amount')::numeric, 0));
  v_cash_no          text    := coalesce(nullif(p_payload->>'cash_account_no',''), '1120');
  v_effective_date   date    := (p_payload->>'effective_date')::date;
  v_commission_gross numeric;
  v_cash_id    text;
  v_ofp_id     text;
  v_mfr_id     text;
  v_vat_id     text;
  v_collection_batch jsonb;
  v_commission_batch jsonb;
begin
  if v_company_id is null then
    raise exception 'GL_PM_COLLECTION_OIC: company_id required' using errcode = '22023';
  end if;
  if v_payment_id is null then
    raise exception 'GL_PM_COLLECTION_OIC: payment_id required' using errcode = '22023';
  end if;
  if v_collected is null or v_collected <= 0 then
    raise exception 'GL_PM_COLLECTION_OIC: collected_amount must be > 0' using errcode = '22023';
  end if;
  if v_commission_net is null or v_commission_net < 0 then
    raise exception 'GL_PM_COLLECTION_OIC: commission_net must be >= 0' using errcode = '22023';
  end if;
  if v_vat_amount < 0 then
    raise exception 'GL_PM_COLLECTION_OIC: vat_amount must be >= 0' using errcode = '22023';
  end if;
  if v_effective_date is null then
    raise exception 'GL_PM_COLLECTION_OIC: effective_date required' using errcode = '22023';
  end if;
  if v_cash_no not in ('1111','1120') then
    raise exception 'GL_PM_COLLECTION_OIC: cash_account_no must be 1111 or 1120' using errcode = '22023';
  end if;

  v_commission_gross := public.gl_pm_round_omr(v_commission_net + v_vat_amount);

  if v_commission_gross > v_collected then
    raise exception 'GL_PM_COLLECTION_OIC: commission_gross (%) exceeds collected_amount (%)',
      v_commission_gross, v_collected using errcode = '22023';
  end if;

  v_cash_id := public.gl_pm_require_account(v_company_id, v_cash_no);
  v_ofp_id  := public.gl_pm_require_account(v_company_id, '2000');
  v_mfr_id  := public.gl_pm_require_account(v_company_id, '4100');
  if v_vat_amount > 0 then
    v_vat_id := public.gl_pm_require_account(v_company_id, '2100');
  end if;

  v_collection_batch := public.post_journal_event(jsonb_build_object(
    'company_id',   v_company_id,
    'source_type',  'pm_collection_oic',
    'source_id',    v_payment_id::text,
    'event_id',     'collect',
    'effective_date', v_effective_date,
    'description',  'PM OWNER_IS_CREDITOR: cash collection → Owner Funds Payable',
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_cash_id, 'debit',  v_collected, 'credit', 0),
      jsonb_build_object('account_id', v_ofp_id,  'debit',  0,           'credit', v_collected)
    )
  ));

  if v_commission_gross > 0 then
    declare
      v_commission_lines jsonb := jsonb_build_array(
        jsonb_build_object('account_id', v_ofp_id, 'debit', v_commission_gross, 'credit', 0),
        jsonb_build_object('account_id', v_mfr_id, 'debit', 0, 'credit', v_commission_net)
      );
    begin
      if v_vat_amount > 0 then
        v_commission_lines := v_commission_lines || jsonb_build_array(
          jsonb_build_object('account_id', v_vat_id, 'debit', 0, 'credit', v_vat_amount)
        );
      end if;

      v_commission_batch := public.post_journal_event(jsonb_build_object(
        'company_id',   v_company_id,
        'source_type',  'pm_commission_oic',
        'source_id',    v_payment_id::text,
        'event_id',     'commission',
        'effective_date', v_effective_date,
        'description',  'PM OWNER_IS_CREDITOR: commission split from OFP → MFR',
        'lines', v_commission_lines
      ));
    end;
  end if;

  return jsonb_build_object(
    'model',             'OWNER_IS_CREDITOR',
    'collected_amount',  v_collected,
    'commission_net',    v_commission_net,
    'vat_amount',        v_vat_amount,
    'commission_gross',  v_commission_gross,
    'collection_batch',  v_collection_batch,
    'commission_batch',  v_commission_batch
  );
end;
$fn$;

alter function public.gl_pm_post_collection_owner_is_creditor(jsonb) owner to postgres;
revoke all on function public.gl_pm_post_collection_owner_is_creditor(jsonb) from public, anon, authenticated;
grant execute on function public.gl_pm_post_collection_owner_is_creditor(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 2: OFFICE_IS_CREDITOR (Invoice & Collection)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_post_invoice_office_is_creditor(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_company_id     uuid    := (p_payload->>'company_id')::uuid;
  v_invoice_id     uuid    := (p_payload->>'invoice_id')::uuid;
  v_invoice_amount numeric := public.gl_pm_round_omr((p_payload->>'invoice_amount')::numeric);
  v_effective_date date    := (p_payload->>'effective_date')::date;
  v_ar_id  text;
  v_ofp_id text;
  v_result jsonb;
begin
  if v_company_id is null then
    raise exception 'GL_PM_INVOICE_OFC: company_id required' using errcode = '22023';
  end if;
  if v_invoice_id is null then
    raise exception 'GL_PM_INVOICE_OFC: invoice_id required' using errcode = '22023';
  end if;
  if v_invoice_amount is null or v_invoice_amount <= 0 then
    raise exception 'GL_PM_INVOICE_OFC: invoice_amount must be > 0' using errcode = '22023';
  end if;
  if v_effective_date is null then
    raise exception 'GL_PM_INVOICE_OFC: effective_date required' using errcode = '22023';
  end if;

  v_ar_id  := public.gl_pm_require_account(v_company_id, '1201');
  v_ofp_id := public.gl_pm_require_account(v_company_id, '2000');

  v_result := public.post_journal_event(jsonb_build_object(
    'company_id',    v_company_id,
    'source_type',   'pm_invoice_ofc',
    'source_id',     v_invoice_id::text,
    'event_id',      'invoice',
    'effective_date', v_effective_date,
    'description',   'PM OFFICE_IS_CREDITOR: invoice → Tenant Receivable vs OFP',
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_ar_id,  'debit', v_invoice_amount, 'credit', 0),
      jsonb_build_object('account_id', v_ofp_id, 'debit', 0, 'credit', v_invoice_amount)
    )
  ));

  return jsonb_build_object(
    'model',          'OFFICE_IS_CREDITOR',
    'step',           'invoice',
    'invoice_amount', v_invoice_amount,
    'batch',          v_result
  );
end;
$fn$;

alter function public.gl_pm_post_invoice_office_is_creditor(jsonb) owner to postgres;
revoke all on function public.gl_pm_post_invoice_office_is_creditor(jsonb) from public, anon, authenticated;
grant execute on function public.gl_pm_post_invoice_office_is_creditor(jsonb) to service_role;

create or replace function public.gl_pm_post_collection_office_is_creditor(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_company_id       uuid    := (p_payload->>'company_id')::uuid;
  v_payment_id       uuid    := (p_payload->>'payment_id')::uuid;
  v_invoice_id       uuid    := (p_payload->>'invoice_id')::uuid;
  v_collected        numeric := public.gl_pm_round_omr((p_payload->>'collected_amount')::numeric);
  v_commission_net   numeric := public.gl_pm_round_omr((p_payload->>'commission_net')::numeric);
  v_vat_amount       numeric := public.gl_pm_round_omr(coalesce((p_payload->>'vat_amount')::numeric, 0));
  v_cash_no          text    := coalesce(nullif(p_payload->>'cash_account_no',''), '1120');
  v_effective_date   date    := (p_payload->>'effective_date')::date;
  v_commission_gross numeric;
  v_cash_id text;
  v_ar_id   text;
  v_ofp_id  text;
  v_mfr_id  text;
  v_vat_id  text;
  v_collection_batch jsonb;
  v_commission_batch jsonb;
begin
  if v_company_id is null then
    raise exception 'GL_PM_COLLECTION_OFC: company_id required' using errcode = '22023';
  end if;
  if v_payment_id is null then
    raise exception 'GL_PM_COLLECTION_OFC: payment_id required' using errcode = '22023';
  end if;
  if v_invoice_id is null then
    raise exception 'GL_PM_COLLECTION_OFC: invoice_id required' using errcode = '22023';
  end if;
  if v_collected is null or v_collected <= 0 then
    raise exception 'GL_PM_COLLECTION_OFC: collected_amount must be > 0' using errcode = '22023';
  end if;
  if v_commission_net is null or v_commission_net < 0 then
    raise exception 'GL_PM_COLLECTION_OFC: commission_net must be >= 0' using errcode = '22023';
  end if;
  if v_vat_amount < 0 then
    raise exception 'GL_PM_COLLECTION_OFC: vat_amount must be >= 0' using errcode = '22023';
  end if;
  if v_effective_date is null then
    raise exception 'GL_PM_COLLECTION_OFC: effective_date required' using errcode = '22023';
  end if;
  if v_cash_no not in ('1111','1120') then
    raise exception 'GL_PM_COLLECTION_OFC: cash_account_no must be 1111 or 1120' using errcode = '22023';
  end if;

  v_commission_gross := public.gl_pm_round_omr(v_commission_net + v_vat_amount);

  if v_commission_gross > v_collected then
    raise exception 'GL_PM_COLLECTION_OFC: commission_gross (%) exceeds collected_amount (%)',
      v_commission_gross, v_collected using errcode = '22023';
  end if;

  v_cash_id := public.gl_pm_require_account(v_company_id, v_cash_no);
  v_ar_id   := public.gl_pm_require_account(v_company_id, '1201');
  v_ofp_id  := public.gl_pm_require_account(v_company_id, '2000');
  v_mfr_id  := public.gl_pm_require_account(v_company_id, '4100');
  if v_vat_amount > 0 then
    v_vat_id := public.gl_pm_require_account(v_company_id, '2100');
  end if;

  v_collection_batch := public.post_journal_event(jsonb_build_object(
    'company_id',   v_company_id,
    'source_type',  'pm_collection_ofc',
    'source_id',    v_payment_id::text,
    'event_id',     'collect',
    'effective_date', v_effective_date,
    'description',  'PM OFFICE_IS_CREDITOR: cash collection → clear Tenant Receivable',
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_cash_id, 'debit', v_collected, 'credit', 0),
      jsonb_build_object('account_id', v_ar_id,   'debit', 0, 'credit', v_collected)
    )
  ));

  if v_commission_gross > 0 then
    declare
      v_commission_lines jsonb := jsonb_build_array(
        jsonb_build_object('account_id', v_ofp_id, 'debit', v_commission_gross, 'credit', 0),
        jsonb_build_object('account_id', v_mfr_id, 'debit', 0, 'credit', v_commission_net)
      );
    begin
      if v_vat_amount > 0 then
        v_commission_lines := v_commission_lines || jsonb_build_array(
          jsonb_build_object('account_id', v_vat_id, 'debit', 0, 'credit', v_vat_amount)
        );
      end if;

      v_commission_batch := public.post_journal_event(jsonb_build_object(
        'company_id',   v_company_id,
        'source_type',  'pm_commission_ofc',
        'source_id',    v_payment_id::text,
        'event_id',     'commission',
        'effective_date', v_effective_date,
        'description',  'PM OFFICE_IS_CREDITOR: commission split from OFP → MFR',
        'lines', v_commission_lines
      ));
    end;
  end if;

  return jsonb_build_object(
    'model',            'OFFICE_IS_CREDITOR',
    'step',             'collection',
    'collected_amount', v_collected,
    'commission_net',   v_commission_net,
    'vat_amount',       v_vat_amount,
    'commission_gross', v_commission_gross,
    'collection_batch', v_collection_batch,
    'commission_batch', v_commission_batch
  );
end;
$fn$;

alter function public.gl_pm_post_collection_office_is_creditor(jsonb) owner to postgres;
revoke all on function public.gl_pm_post_collection_office_is_creditor(jsonb) from public, anon, authenticated;
grant execute on function public.gl_pm_post_collection_office_is_creditor(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 3: gl_pm_accrue_fixed_monthly_fee
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_accrue_fixed_monthly_fee(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_company_id     uuid    := (p_payload->>'company_id')::uuid;
  v_agreement_id   uuid    := (p_payload->>'agreement_id')::uuid;
  v_accrual_period text    := p_payload->>'accrual_period';
  v_accrual_net    numeric := public.gl_pm_round_omr((p_payload->>'accrual_net')::numeric);
  v_vat_amount     numeric := public.gl_pm_round_omr(coalesce((p_payload->>'vat_amount')::numeric, 0));
  v_effective_date date    := (p_payload->>'effective_date')::date;
  v_accrual_gross  numeric;
  v_due_id text;
  v_mfr_id text;
  v_vat_id text;
  v_lines  jsonb;
  v_result jsonb;
begin
  if v_company_id is null then
    raise exception 'GL_PM_ACCRUE: company_id required' using errcode = '22023';
  end if;
  if v_agreement_id is null then
    raise exception 'GL_PM_ACCRUE: agreement_id required' using errcode = '22023';
  end if;
  if v_accrual_period is null or v_accrual_period = '' then
    raise exception 'GL_PM_ACCRUE: accrual_period required (e.g. 2026-08-01/2026-08-31)' using errcode = '22023';
  end if;
  if v_accrual_net is null or v_accrual_net < 0 then
    raise exception 'GL_PM_ACCRUE: accrual_net must be >= 0' using errcode = '22023';
  end if;
  if v_vat_amount < 0 then
    raise exception 'GL_PM_ACCRUE: vat_amount must be >= 0' using errcode = '22023';
  end if;
  if v_effective_date is null then
    raise exception 'GL_PM_ACCRUE: effective_date required' using errcode = '22023';
  end if;

  v_accrual_gross := public.gl_pm_round_omr(v_accrual_net + v_vat_amount);

  v_due_id := public.gl_pm_require_account(v_company_id, '1300');
  v_mfr_id := public.gl_pm_require_account(v_company_id, '4100');
  if v_vat_amount > 0 then
    v_vat_id := public.gl_pm_require_account(v_company_id, '2100');
  end if;

  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_due_id, 'debit', v_accrual_gross, 'credit', 0),
    jsonb_build_object('account_id', v_mfr_id, 'debit', 0, 'credit', v_accrual_net)
  );
  if v_vat_amount > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_id', v_vat_id, 'debit', 0, 'credit', v_vat_amount)
    );
  end if;

  v_result := public.post_journal_event(jsonb_build_object(
    'company_id',    v_company_id,
    'source_type',   'pm_fixed_monthly_accrual',
    'source_id',     v_agreement_id::text,
    'event_id',      'accrual:' || v_accrual_period,
    'effective_date', v_effective_date,
    'description',   'PM FIXED_MONTHLY DAILY_ACCRUAL: Due from Owner → MFR period ' || v_accrual_period,
    'lines',         v_lines
  ));

  return jsonb_build_object(
    'model',          'FIXED_MONTHLY_DAILY_ACCRUAL',
    'accrual_period', v_accrual_period,
    'accrual_net',    v_accrual_net,
    'vat_amount',     v_vat_amount,
    'accrual_gross',  v_accrual_gross,
    'batch',          v_result
  );
end;
$fn$;

alter function public.gl_pm_accrue_fixed_monthly_fee(jsonb) owner to postgres;
revoke all on function public.gl_pm_accrue_fixed_monthly_fee(jsonb) from public, anon, authenticated;
grant execute on function public.gl_pm_accrue_fixed_monthly_fee(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 4: gl_pm_post_owner_payment
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_post_owner_payment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_company_id     uuid    := (p_payload->>'company_id')::uuid;
  v_settlement_id  text    := p_payload->>'settlement_id';
  v_net_payout     numeric := public.gl_pm_round_omr((p_payload->>'net_payout')::numeric);
  v_cash_no        text    := coalesce(nullif(p_payload->>'cash_account_no',''), '1120');
  v_effective_date date    := (p_payload->>'effective_date')::date;
  v_settlement_status text;
  v_ofp_id  text;
  v_cash_id text;
  v_result  jsonb;
begin
  if v_company_id is null then
    raise exception 'GL_PM_OWNER_PAYMENT: company_id required' using errcode = '22023';
  end if;
  if v_settlement_id is null or v_settlement_id = '' then
    raise exception 'GL_PM_OWNER_PAYMENT: settlement_id required' using errcode = '22023';
  end if;
  if v_net_payout is null or v_net_payout <= 0 then
    raise exception 'GL_PM_OWNER_PAYMENT: net_payout must be > 0' using errcode = '22023';
  end if;
  if v_effective_date is null then
    raise exception 'GL_PM_OWNER_PAYMENT: effective_date required' using errcode = '22023';
  end if;
  if v_cash_no not in ('1111','1120') then
    raise exception 'GL_PM_OWNER_PAYMENT: cash_account_no must be 1111 or 1120' using errcode = '22023';
  end if;

  select s.status into v_settlement_status
    from public.owner_settlements s
   where s.id = v_settlement_id
     and s.company_id = v_company_id;

  if not found then
    raise exception 'GL_PM_OWNER_PAYMENT: settlement % not found for company %',
      v_settlement_id, v_company_id using errcode = 'P0002';
  end if;

  if v_settlement_status = 'DRAFT' then
    raise exception 'GL_PM_OWNER_PAYMENT: cannot post payment for a DRAFT settlement (%)',
      v_settlement_id using errcode = '55000';
  end if;

  v_ofp_id  := public.gl_pm_require_account(v_company_id, '2000');
  v_cash_id := public.gl_pm_require_account(v_company_id, v_cash_no);

  v_result := public.post_journal_event(jsonb_build_object(
    'company_id',    v_company_id,
    'source_type',   'pm_owner_payment',
    'source_id',     v_settlement_id,
    'event_id',      'pay_owner',
    'effective_date', v_effective_date,
    'description',   'PM owner payout: Owner Funds Payable → Bank',
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_ofp_id,  'debit', v_net_payout, 'credit', 0),
      jsonb_build_object('account_id', v_cash_id, 'debit', 0, 'credit', v_net_payout)
    )
  ));

  return jsonb_build_object(
    'model',         'OWNER_IS_CREDITOR',
    'step',          'owner_payment',
    'settlement_id', v_settlement_id,
    'net_payout',    v_net_payout,
    'batch',         v_result
  );
end;
$fn$;

alter function public.gl_pm_post_owner_payment(jsonb) owner to postgres;
revoke all on function public.gl_pm_post_owner_payment(jsonb) from public, anon, authenticated;
grant execute on function public.gl_pm_post_owner_payment(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 5: gl_pm_post_owner_expense
-- When office pays on behalf of owner: Dr 1300 Due from Owners / Cr 1120 Bank
-- (NOT 6100 Company Operating Expense)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_post_owner_expense(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_company_id     uuid    := (p_payload->>'company_id')::uuid;
  v_expense_id     uuid    := (p_payload->>'expense_id')::uuid;
  v_amount         numeric := public.gl_pm_round_omr((p_payload->>'amount')::numeric);
  v_cash_no        text    := coalesce(nullif(p_payload->>'cash_account_no',''), '1120');
  v_effective_date date    := (p_payload->>'effective_date')::date;
  v_due_id  text;
  v_cash_id text;
  v_result  jsonb;
begin
  if v_company_id is null or v_expense_id is null or v_effective_date is null then
    raise exception 'GL_PM_OWNER_EXPENSE: company_id, expense_id, and effective_date required' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'GL_PM_OWNER_EXPENSE: amount must be > 0' using errcode = '22023';
  end if;
  if v_cash_no not in ('1111','1120') then
    raise exception 'GL_PM_OWNER_EXPENSE: cash_account_no must be 1111 or 1120' using errcode = '22023';
  end if;

  v_due_id  := public.gl_pm_require_account(v_company_id, '1300');
  v_cash_id := public.gl_pm_require_account(v_company_id, v_cash_no);

  v_result := public.post_journal_event(jsonb_build_object(
    'company_id',    v_company_id,
    'source_type',   'pm_owner_expense',
    'source_id',     v_expense_id::text,
    'event_id',      'pay_owner_expense',
    'effective_date', v_effective_date,
    'description',   'PM Owner expense: Due from Owners vs Cash/Bank',
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_due_id,  'debit', v_amount, 'credit', 0),
      jsonb_build_object('account_id', v_cash_id, 'debit', 0, 'credit', v_amount)
    )
  ));

  return jsonb_build_object(
    'model',        'OWNER_EXPENSE',
    'expense_id',   v_expense_id,
    'amount',       v_amount,
    'batch',        v_result
  );
end;
$fn$;

alter function public.gl_pm_post_owner_expense(jsonb) owner to postgres;
revoke all on function public.gl_pm_post_owner_expense(jsonb) from public, anon, authenticated;
grant execute on function public.gl_pm_post_owner_expense(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 6: gl_pm_post_deposit_receipt
-- Dr Cash/Bank / Cr Tenant Deposits Payable (2200) (never revenue)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_post_deposit_receipt(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_company_id     uuid    := (p_payload->>'company_id')::uuid;
  v_deposit_id     uuid    := (p_payload->>'deposit_id')::uuid;
  v_amount         numeric := public.gl_pm_round_omr((p_payload->>'amount')::numeric);
  v_cash_no        text    := coalesce(nullif(p_payload->>'cash_account_no',''), '1120');
  v_effective_date date    := (p_payload->>'effective_date')::date;
  v_dep_id  text;
  v_cash_id text;
  v_result  jsonb;
begin
  if v_company_id is null or v_deposit_id is null or v_effective_date is null then
    raise exception 'GL_PM_DEPOSIT_RECEIPT: company_id, deposit_id, and effective_date required' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'GL_PM_DEPOSIT_RECEIPT: amount must be > 0' using errcode = '22023';
  end if;

  v_dep_id  := public.gl_pm_require_account(v_company_id, '2200');
  v_cash_id := public.gl_pm_require_account(v_company_id, v_cash_no);

  v_result := public.post_journal_event(jsonb_build_object(
    'company_id',    v_company_id,
    'source_type',   'pm_deposit_receipt',
    'source_id',     v_deposit_id::text,
    'event_id',      'collect_deposit',
    'effective_date', v_effective_date,
    'description',   'Tenant security deposit collected → Tenant Deposits Payable',
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_cash_id, 'debit', v_amount, 'credit', 0),
      jsonb_build_object('account_id', v_dep_id,  'debit', 0, 'credit', v_amount)
    )
  ));

  return jsonb_build_object('step', 'deposit_receipt', 'deposit_id', v_deposit_id, 'amount', v_amount, 'batch', v_result);
end;
$fn$;

alter function public.gl_pm_post_deposit_receipt(jsonb) owner to postgres;
revoke all on function public.gl_pm_post_deposit_receipt(jsonb) from public, anon, authenticated;
grant execute on function public.gl_pm_post_deposit_receipt(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 7: gl_pm_post_deposit_refund
-- Dr Tenant Deposits Payable (2200) / Cr Cash/Bank
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_post_deposit_refund(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_company_id uuid := (p_payload->>'company_id')::uuid;
  v_deposit_id text := nullif(btrim(coalesce(p_payload->>'deposit_id', '')), '');
  v_request_id text := coalesce(nullif(btrim(coalesce(p_payload->>'request_id', '')), ''), v_deposit_id || ':refund');
  v_amount numeric := public.gl_pm_round_omr((p_payload->>'amount')::numeric);
  v_cash_no text := coalesce(nullif(p_payload->>'cash_account_no',''), '1120');
  v_effective_date date := (p_payload->>'effective_date')::date;
  v_deposit public.tenant_deposits%rowtype;
  v_dep_id text;
  v_cash_id text;
  v_transaction_created boolean := false;
  v_result jsonb;
begin
  if v_company_id is null or v_deposit_id is null or v_effective_date is null then
    raise exception 'GL_PM_DEPOSIT_REFUND: company_id, deposit_id, and effective_date required' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'GL_PM_DEPOSIT_REFUND: amount must be > 0' using errcode = '22023';
  end if;
  if v_cash_no not in ('1111', '1120') then
    raise exception 'GL_PM_DEPOSIT_REFUND: cash_account_no must be 1111 or 1120' using errcode = '22023';
  end if;

  select * into v_deposit
    from public.tenant_deposits
   where id = v_deposit_id
     and company_id = v_company_id
     and deleted_at is null
   for update;
  if not found then
    raise exception 'GL_PM_DEPOSIT_REFUND: deposit not found for company' using errcode = '42501';
  end if;
  if v_deposit.remaining_amount < v_amount then
    raise exception 'GL_PM_DEPOSIT_REFUND: refund exceeds remaining deposit balance' using errcode = '22023';
  end if;

  v_dep_id := public.gl_pm_require_account(v_company_id, '2200');
  v_cash_id := public.gl_pm_require_account(v_company_id, v_cash_no);

  v_result := public.post_journal_event(jsonb_build_object(
    'company_id', v_company_id,
    'source_type', 'pm_deposit_refund',
    'source_id', v_deposit_id,
    'event_id', 'refund_deposit',
    'effective_date', v_effective_date,
    'description', 'Tenant security deposit refunded from Tenant Deposits Payable',
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_dep_id, 'debit', v_amount, 'credit', 0),
      jsonb_build_object('account_id', v_cash_id, 'debit', 0, 'credit', v_amount)
    )
  ));

  insert into public.deposit_transactions (
    deposit_id, type, amount, reason, description, request_id
  ) values (
    v_deposit_id, 'refund', v_amount, 'refund_partial',
    'GL tenant deposit refund', v_request_id
  )
  on conflict (request_id) do nothing;
  get diagnostics v_transaction_created = row_count > 0;

  if v_transaction_created then
    update public.tenant_deposits
       set refunded_amount = public.gl_pm_round_omr(refunded_amount + v_amount),
           remaining_amount = public.gl_pm_round_omr(remaining_amount - v_amount),
           status = case when public.gl_pm_round_omr(remaining_amount - v_amount) = 0 then 'refunded' else 'partially_refunded' end,
           settled_date = case when public.gl_pm_round_omr(remaining_amount - v_amount) = 0 then v_effective_date else settled_date end,
           updated_at = now()
     where id = v_deposit_id
       and company_id = v_company_id;
  end if;

  return jsonb_build_object(
    'step', 'deposit_refund',
    'deposit_id', v_deposit_id,
    'amount', v_amount,
    'idempotent', not v_transaction_created,
    'batch', v_result
  );
end;
$fn$;

alter function public.gl_pm_post_deposit_refund(jsonb) owner to postgres;
revoke all on function public.gl_pm_post_deposit_refund(jsonb) from public, anon, authenticated;
grant execute on function public.gl_pm_post_deposit_refund(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 8: gl_pm_post_deposit_application
-- Apply deposit to rent (1201 or 2000) or damages (4300)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_post_deposit_application(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_company_id uuid := (p_payload->>'company_id')::uuid;
  v_deposit_id text := nullif(btrim(coalesce(p_payload->>'deposit_id', '')), '');
  v_target_type text := nullif(btrim(coalesce(p_payload->>'target_type', '')), '');
  v_request_id text := coalesce(
    nullif(btrim(coalesce(p_payload->>'request_id', '')), ''),
    v_deposit_id || ':apply:' || coalesce(v_target_type, '')
  );
  v_amount numeric := public.gl_pm_round_omr((p_payload->>'amount')::numeric);
  v_effective_date date := (p_payload->>'effective_date')::date;
  v_deposit public.tenant_deposits%rowtype;
  v_collection_role text;
  v_deposit_beneficiary text;
  v_dep_id text;
  v_target_id text;
  v_target_no text;
  v_reason text;
  v_transaction_created boolean := false;
  v_result jsonb;
begin
  if v_company_id is null or v_deposit_id is null or v_target_type is null or v_effective_date is null then
    raise exception 'GL_PM_DEPOSIT_APP: company_id, deposit_id, target_type, and effective_date required' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'GL_PM_DEPOSIT_APP: amount must be > 0' using errcode = '22023';
  end if;

  -- The application target is never caller-authoritative. Lock the actual
  -- deposit and derive the legal recipient from the contract's frozen terms.
  select d.*, c.collection_role_snapshot, v.deposit_beneficiary
    into v_deposit, v_collection_role, v_deposit_beneficiary
    from public.tenant_deposits d
    join public.contracts c
      on c.id::text = d.contract_id::text
     and c.company_id = v_company_id
     and c.deleted_at is null
    left join public.owner_agreement_versions v
      on v.id = c.agreement_version_id
     and v.company_id = v_company_id
   where d.id = v_deposit_id
     and d.company_id = v_company_id
     and d.deleted_at is null
   for update of d;

  if not found then
    raise exception 'GL_PM_DEPOSIT_APP: deposit not found for company' using errcode = '42501';
  end if;
  if v_deposit.remaining_amount < v_amount then
    raise exception 'GL_PM_DEPOSIT_APP: amount exceeds remaining deposit balance' using errcode = '22023';
  end if;

  case v_target_type
    when 'rent_arrears' then
      if v_collection_role <> 'OFFICE_IS_CREDITOR' then
        raise exception 'GL_PM_DEPOSIT_APP: rent arrears use 2000 Owner Funds Payable for OWNER_IS_CREDITOR contracts' using errcode = '22023';
      end if;
      v_target_no := '1201';
      v_reason := 'unpaid_arrears';
    when 'owner_arrears' then
      if v_collection_role <> 'OWNER_IS_CREDITOR' then
        raise exception 'GL_PM_DEPOSIT_APP: owner_arrears is only valid for OWNER_IS_CREDITOR contracts' using errcode = '22023';
      end if;
      v_target_no := '2000';
      v_reason := 'unpaid_arrears';
    when 'damage' then
      if v_deposit_beneficiary = 'OWNER' then
        v_target_no := '2000';
      elsif v_deposit_beneficiary = 'OFFICE' then
        v_target_no := '4300';
      else
        raise exception 'GL_PM_DEPOSIT_APP: damage beneficiary is not fixed in the contract agreement snapshot' using errcode = '23514';
      end if;
      v_reason := 'maintenance_damage';
    else
      raise exception 'GL_PM_DEPOSIT_APP: target_type must be rent_arrears, owner_arrears, or damage' using errcode = '22023';
  end case;

  v_dep_id := public.gl_pm_require_account(v_company_id, '2200');
  v_target_id := public.gl_pm_require_account(v_company_id, v_target_no);

  v_result := public.post_journal_event(jsonb_build_object(
    'company_id', v_company_id,
    'source_type', 'pm_deposit_application',
    'source_id', v_deposit_id,
    'event_id', 'apply:' || v_target_type,
    'effective_date', v_effective_date,
    'description', 'Deposit applied to ' || v_target_type,
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_dep_id, 'debit', v_amount, 'credit', 0),
      jsonb_build_object('account_id', v_target_id, 'debit', 0, 'credit', v_amount)
    )
  ));

  insert into public.deposit_transactions (
    deposit_id, type, amount, reason, description, request_id
  ) values (
    v_deposit_id, 'deduction', v_amount, v_reason,
    'GL deposit application: ' || v_target_type, v_request_id
  )
  on conflict (request_id) do nothing;

  get diagnostics v_transaction_created = row_count > 0;
  if v_transaction_created then
    update public.tenant_deposits
       set deducted_amount = public.gl_pm_round_omr(deducted_amount + v_amount),
           remaining_amount = public.gl_pm_round_omr(remaining_amount - v_amount),
           status = case
             when public.gl_pm_round_omr(remaining_amount - v_amount) = 0
               then case when v_reason = 'unpaid_arrears' then 'forfeited_arrears' else 'forfeited_damage' end
             else 'partially_deducted'
           end,
           settled_date = case when public.gl_pm_round_omr(remaining_amount - v_amount) = 0 then v_effective_date else settled_date end,
           updated_at = now()
     where id = v_deposit_id
       and company_id = v_company_id;
  end if;

  return jsonb_build_object(
    'step', 'deposit_application',
    'deposit_id', v_deposit_id,
    'target_type', v_target_type,
    'target_account_no', v_target_no,
    'amount', v_amount,
    'idempotent', not v_transaction_created,
    'batch', v_result
  );
end;
$fn$;

alter function public.gl_pm_post_deposit_application(jsonb) owner to postgres;
revoke all on function public.gl_pm_post_deposit_application(jsonb) from public, anon, authenticated;
grant execute on function public.gl_pm_post_deposit_application(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 9: Broker Commissions (Approval & Payment)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_post_broker_commission_approval(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_company_id     uuid    := (p_payload->>'company_id')::uuid;
  v_commission_id  uuid    := (p_payload->>'commission_id')::uuid;
  v_amount         numeric := public.gl_pm_round_omr((p_payload->>'amount')::numeric);
  v_effective_date date    := (p_payload->>'effective_date')::date;
  v_exp_id text;
  v_pay_id text;
  v_result jsonb;
begin
  if v_company_id is null or v_commission_id is null or v_effective_date is null then
    raise exception 'GL_PM_COMM_APPROVE: company_id, commission_id, and effective_date required' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'GL_PM_COMM_APPROVE: amount must be > 0' using errcode = '22023';
  end if;

  v_exp_id := public.gl_pm_require_account(v_company_id, '6110');
  v_pay_id := public.gl_pm_require_account(v_company_id, '2300');

  v_result := public.post_journal_event(jsonb_build_object(
    'company_id',    v_company_id,
    'source_type',   'broker_commission_accrual',
    'source_id',     v_commission_id::text,
    'event_id',      'approve_commission',
    'effective_date', v_effective_date,
    'description',   'Broker Commission: Broker Commission Expense → Broker Commissions Payable',
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_exp_id, 'debit', v_amount, 'credit', 0),
      jsonb_build_object('account_id', v_pay_id, 'debit', 0, 'credit', v_amount)
    )
  ));

  return jsonb_build_object('step', 'broker_commission_approval', 'commission_id', v_commission_id, 'amount', v_amount, 'batch', v_result);
end;
$fn$;

alter function public.gl_pm_post_broker_commission_approval(jsonb) owner to postgres;
revoke all on function public.gl_pm_post_broker_commission_approval(jsonb) from public, anon, authenticated;
grant execute on function public.gl_pm_post_broker_commission_approval(jsonb) to service_role;

create or replace function public.gl_pm_post_broker_commission_payment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_company_id     uuid    := (p_payload->>'company_id')::uuid;
  v_commission_id  uuid    := (p_payload->>'commission_id')::uuid;
  v_amount         numeric := public.gl_pm_round_omr((p_payload->>'amount')::numeric);
  v_cash_no        text    := coalesce(nullif(p_payload->>'cash_account_no',''), '1120');
  v_effective_date date    := (p_payload->>'effective_date')::date;
  v_pay_id  text;
  v_cash_id text;
  v_result  jsonb;
begin
  if v_company_id is null or v_commission_id is null or v_effective_date is null then
    raise exception 'GL_PM_COMM_PAY: company_id, commission_id, and effective_date required' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'GL_PM_COMM_PAY: amount must be > 0' using errcode = '22023';
  end if;

  v_pay_id  := public.gl_pm_require_account(v_company_id, '2300');
  v_cash_id := public.gl_pm_require_account(v_company_id, v_cash_no);

  v_result := public.post_journal_event(jsonb_build_object(
    'company_id',    v_company_id,
    'source_type',   'broker_commission_payout',
    'source_id',     v_commission_id::text,
    'event_id',      'pay_commission',
    'effective_date', v_effective_date,
    'description',   'Broker Commission Payout: Broker Commissions Payable → Bank/Cash',
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_pay_id,  'debit', v_amount, 'credit', 0),
      jsonb_build_object('account_id', v_cash_id, 'debit', 0, 'credit', v_amount)
    )
  ));

  return jsonb_build_object('step', 'broker_commission_payment', 'commission_id', v_commission_id, 'amount', v_amount, 'batch', v_result);
end;
$fn$;

alter function public.gl_pm_post_broker_commission_payment(jsonb) owner to postgres;
revoke all on function public.gl_pm_post_broker_commission_payment(jsonb) from public, anon, authenticated;
grant execute on function public.gl_pm_post_broker_commission_payment(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- List RPC (authenticated ADMIN/MANAGER, company-scoped)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_list_batches(p_limit int default 50, p_offset int default 0)
returns table (
  batch_id uuid,
  source_type text,
  source_id text,
  event_id text,
  status text,
  effective_date date,
  posted_at timestamptz,
  description text
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $fn$
declare
  v_company_id uuid := public.require_company_id();
begin
  return query
    select b.id, b.source_type, b.source_id, b.event_id,
           b.status, b.effective_date, b.posted_at, b.description
      from public.journal_batches b
     where b.company_id = v_company_id
       and (b.source_type like 'pm_%' or b.source_type like 'broker_%' or b.source_type = 'receipt')
     order by b.effective_date desc, b.created_at desc
     limit p_limit
     offset p_offset;
end;
$fn$;

alter function public.gl_pm_list_batches(int,int) owner to postgres;
revoke all on function public.gl_pm_list_batches(int,int) from public, anon;
grant execute on function public.gl_pm_list_batches(int,int) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 10: Subledger ↔ General Ledger Reconciliation
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_reconcile_subledgers(p_as_of_date date default current_date)
returns table (
  account_no text,
  account_name text,
  gl_balance numeric,
  subledger_balance numeric,
  mismatch numeric,
  is_reconciled boolean,
  details jsonb
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $fn$
declare
  v_company_id uuid := public.require_company_id();
  v_gl_2000 numeric := 0;
  v_gl_1201 numeric := 0;
  v_gl_2200 numeric := 0;
  v_gl_1300 numeric := 0;
  v_gl_2300 numeric := 0;
  v_sub_2000 numeric := 0;
  v_sub_1201 numeric := 0;
  v_sub_2200 numeric := 0;
  v_sub_1300 numeric := 0;
  v_sub_2300 numeric := 0;
begin
  -- GL balances up to p_as_of_date
  select coalesce(sum(l.credit - l.debit), 0) into v_gl_2000
    from public.journal_lines l
    join public.journal_batches b on b.id = l.batch_id
    join public.accounts a on a.id = l.account_id
   where b.company_id = v_company_id and b.status = 'POSTED'
     and a.no = '2000' and b.effective_date <= p_as_of_date;

  select coalesce(sum(l.debit - l.credit), 0) into v_gl_1201
    from public.journal_lines l
    join public.journal_batches b on b.id = l.batch_id
    join public.accounts a on a.id = l.account_id
   where b.company_id = v_company_id and b.status = 'POSTED'
     and a.no = '1201' and b.effective_date <= p_as_of_date;

  select coalesce(sum(l.credit - l.debit), 0) into v_gl_2200
    from public.journal_lines l
    join public.journal_batches b on b.id = l.batch_id
    join public.accounts a on a.id = l.account_id
   where b.company_id = v_company_id and b.status = 'POSTED'
     and a.no = '2200' and b.effective_date <= p_as_of_date;

  select coalesce(sum(l.debit - l.credit), 0) into v_gl_1300
    from public.journal_lines l
    join public.journal_batches b on b.id = l.batch_id
    join public.accounts a on a.id = l.account_id
   where b.company_id = v_company_id and b.status = 'POSTED'
     and a.no = '1300' and b.effective_date <= p_as_of_date;

  select coalesce(sum(l.credit - l.debit), 0) into v_gl_2300
    from public.journal_lines l
    join public.journal_batches b on b.id = l.batch_id
    join public.accounts a on a.id = l.account_id
   where b.company_id = v_company_id and b.status = 'POSTED'
     and a.no = '2300' and b.effective_date <= p_as_of_date;

  -- Operational subledger sums
  -- 2000: Net payable remaining on active/approved settlements not yet paid
  select coalesce(sum(s.net_payable), 0) into v_sub_2000
    from public.owner_settlements s
   where s.company_id = v_company_id and s.status in ('PENDING', 'APPROVED')
     and s.period_end <= p_as_of_date;

  -- 1201: Outstanding invoices
  select coalesce(sum(i.amount + coalesce(i.tax_amount, 0) - coalesce(i.paid_amount, 0)), 0) into v_sub_1201
    from public.invoices i
   where i.company_id = v_company_id and i.deleted_at is null
     and i.status in ('UNPAID', 'PARTIALLY_PAID')
     and i.due_date <= p_as_of_date;

  -- 2200: Active tenant deposits held
  if to_regclass('public.tenant_deposits') is not null then
    select coalesce(sum(d.remaining_amount), 0) into v_sub_2200
      from public.tenant_deposits d
     where d.company_id = v_company_id and d.deleted_at is null;
  end if;

  -- 2300: Pending commissions
  if to_regclass('public.commissions') is not null then
    select coalesce(sum(c.amount), 0) into v_sub_2300
      from public.commissions c
     where c.company_id = v_company_id and c.status = 'pending';
  end if;

  -- Return rows
  return query values
    ('2000'::text, 'Owner Funds Payable'::text, round(v_gl_2000, 3), round(v_sub_2000, 3),
     round(v_gl_2000 - v_sub_2000, 3), abs(v_gl_2000 - v_sub_2000) < 0.001,
     jsonb_build_object('account', '2000', 'type', 'liability')),
    ('1201'::text, 'Tenant Receivable'::text, round(v_gl_1201, 3), round(v_sub_1201, 3),
     round(v_gl_1201 - v_sub_1201, 3), abs(v_gl_1201 - v_sub_1201) < 0.001,
     jsonb_build_object('account', '1201', 'type', 'asset')),
    ('2200'::text, 'Tenant Deposits Payable'::text, round(v_gl_2200, 3), round(v_sub_2200, 3),
     round(v_gl_2200 - v_sub_2200, 3), abs(v_gl_2200 - v_sub_2200) < 0.001,
     jsonb_build_object('account', '2200', 'type', 'liability')),
    ('1300'::text, 'Due from Owners'::text, round(v_gl_1300, 3), round(v_sub_1300, 3),
     round(v_gl_1300 - v_sub_1300, 3), abs(v_gl_1300 - v_sub_1300) < 0.001,
     jsonb_build_object('account', '1300', 'type', 'asset')),
    ('2300'::text, 'Broker Commissions Payable'::text, round(v_gl_2300, 3), round(v_sub_2300, 3),
     round(v_gl_2300 - v_sub_2300, 3), abs(v_gl_2300 - v_sub_2300) < 0.001,
     jsonb_build_object('account', '2300', 'type', 'liability'));
end;
$fn$;

alter function public.gl_reconcile_subledgers(date) owner to postgres;
revoke all on function public.gl_reconcile_subledgers(date) from public, anon;
grant execute on function public.gl_reconcile_subledgers(date) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 11: Read-Only Historical Financial Diagnostics & Audit
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_diagnose_historical_financial_integrity()
returns table (
  company_id uuid,
  category text,
  finding text,
  entity_id text,
  details jsonb
)
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $fn$
declare
  v_company_id uuid := public.require_company_id();
begin
  -- 1. Check duplicate settlement usage
  return query
  select v_company_id,
         'duplicate_settlement_payment'::text,
         'Payment included in multiple active settlements'::text,
         p.payment_id::text,
         jsonb_build_object('settlement_count', count(*), 'settlements', jsonb_agg(p.settlement_id))
    from public.owner_settlement_payment_links p
   where p.company_id = v_company_id and p.released_at is null
   group by p.payment_id
  having count(*) > 1;

  -- 2. Check owner expenses incorrectly charged to 6100
  return query
  select v_company_id,
         'owner_expense_classification'::text,
         'Owner expense recorded as company expense'::text,
         e.id::text,
         jsonb_build_object('amount', e.amount, 'category', e.category, 'charged_to', e.charged_to)
    from public.expenses e
   where e.company_id = v_company_id
     and e.deleted_at is null
     and upper(coalesce(e.charged_to, '')) = 'OWNER'
     and exists (
       select 1 from public.journal_lines l
       join public.accounts a on a.id = l.account_id
       where l.ref_source_id = e.id::text and a.no = '6100'
     );

  -- 3. Check orphan journal batches (source entity missing or deleted)
  return query
  select v_company_id,
         'orphan_journal_batch'::text,
         'Journal batch source entity does not exist or is deleted'::text,
         b.id::text,
         jsonb_build_object('source_type', b.source_type, 'source_id', b.source_id)
    from public.journal_batches b
   where b.company_id = v_company_id
     and b.source_type in ('receipt', 'pm_collection_oic', 'pm_collection_ofc')
     and not exists (
       select 1 from public.receipts r where r.id::text = b.source_id::text and r.company_id = v_company_id
     );
end;
$fn$;

alter function public.gl_diagnose_historical_financial_integrity() owner to postgres;
revoke all on function public.gl_diagnose_historical_financial_integrity() from public, anon;
grant execute on function public.gl_diagnose_historical_financial_integrity() to authenticated, service_role;

commit;
