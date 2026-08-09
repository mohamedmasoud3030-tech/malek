-- =============================================================================
-- Stage S04 — property_management GL posting RPCs
--
-- ADR: docs/adr/0010-accounting-legal-reference.md
-- Governance: governance/canonical-business-rules.json
--   operating_model: OWNER_AGENCY (AGENT_NET)
--   collection_roles: OWNER_IS_CREDITOR (default), OFFICE_IS_CREDITOR (explicit)
--   commission_recognition_basis: RATE→ON_COLLECTION, FIXED_MONTHLY→DAILY_ACCRUAL
--   currency: OMR, precision: 3 decimal places
--
-- This migration adds server-side atomic RPCs for the property_management
-- (AGENT_NET) accounting model. All RPCs post via post_journal_event() and are
-- accessible only to service_role — the browser cannot post free-form journals.
--
-- RPCs added:
--   gl_pm_post_collection_owner_is_creditor   — RATE on-collection
--   gl_pm_post_collection_office_is_creditor  — RATE on-collection (OFFICE creditor)
--   gl_pm_accrue_fixed_monthly_fee            — DAILY_ACCRUAL server-side
--   gl_pm_post_owner_payment                  — pay owner (reduce OFP)
--
-- No Backfill. No historical data is touched.
-- Rollback: supabase/rollback/20260809_rollback_s04_property_management_gl_rpcs.sql
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: resolve required account_id for a company + account_no.
-- Raises a deterministic exception when the account is missing or inactive
-- so every caller fails with a clear, auditable message.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_require_account(
  p_company_id uuid,
  p_account_no  text
)
returns uuid
language plpgsql
stable
set search_path = public, pg_temp
as $fn$
declare
  v_id uuid;
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
-- Called when a payment is collected on a property-management contract where
-- the owner is the economic creditor.
--
-- Entries posted (OMR, 3dp):
--   Dr  1120 Bank (or 1111 Cash)         collected_amount
--     Cr  2000 Owner Funds Payable        collected_amount
--   [split commission from OFP:]
--   Dr  2000 Owner Funds Payable          commission_gross
--     Cr  4100 Management Fee Revenue     commission_net
--     Cr  2100 VAT Payable                vat_amount        (only when vat_amount > 0)
--
-- Payload fields:
--   company_id         uuid      (required)
--   payment_id         uuid      (required — idempotency source_id)
--   collected_amount   numeric   (required, > 0, OMR 3dp)
--   commission_net     numeric   (required, >= 0, OMR 3dp)
--   vat_amount         numeric   (optional, default 0, OMR 3dp)
--   cash_account_no    text      (optional, default '1120')
--   effective_date     date      (required)
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
  -- Account IDs
  v_cash_id    uuid;
  v_ofp_id     uuid;
  v_mfr_id     uuid;
  v_vat_id     uuid;
  -- Batch results
  v_collection_batch jsonb;
  v_commission_batch jsonb;
begin
  -- ── Guards ────────────────────────────────────────────────────────────────
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

  -- ── Resolve accounts ──────────────────────────────────────────────────────
  v_cash_id := public.gl_pm_require_account(v_company_id, v_cash_no);
  v_ofp_id  := public.gl_pm_require_account(v_company_id, '2000');
  v_mfr_id  := public.gl_pm_require_account(v_company_id, '4100');
  if v_vat_amount > 0 then
    v_vat_id := public.gl_pm_require_account(v_company_id, '2100');
  end if;

  -- ── Batch 1: Cash collection → Owner Funds Payable ───────────────────────
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

  -- ── Batch 2: Commission split from Owner Funds Payable ───────────────────
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

comment on function public.gl_pm_post_collection_owner_is_creditor(jsonb) is
'PM AGENT_NET / OWNER_IS_CREDITOR / RATE / ON_COLLECTION.
Posts two idempotent GL batches: (1) Cash → OFP; (2) OFP → MFR + VAT.
Browser roles cannot call this function. ADR-0010.';

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 2: gl_pm_post_collection_office_is_creditor
--
-- OWNER_AGENCY / OFFICE_IS_CREDITOR / RATE / ON_COLLECTION
--
-- Invoice step (at invoice time, called separately):
--   Dr  1201 Tenant Receivable           invoice_amount
--     Cr  2000 Owner Funds Payable        invoice_amount
--
-- Collection step (at payment time):
--   Dr  1120 Bank (or 1111 Cash)         collected_amount
--     Cr  1201 Tenant Receivable          collected_amount
-- Then commission split same as OWNER_IS_CREDITOR.
--
-- Payload fields (invoice):
--   company_id, invoice_id, invoice_amount, effective_date
--
-- Payload fields (collection):
--   company_id, payment_id, collected_amount, invoice_id,
--   commission_net, vat_amount (opt), cash_account_no (opt), effective_date
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
  v_ar_id  uuid;
  v_ofp_id uuid;
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

  -- Dr Tenant Receivable / Cr Owner Funds Payable
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

comment on function public.gl_pm_post_invoice_office_is_creditor(jsonb) is
'PM AGENT_NET / OFFICE_IS_CREDITOR: invoice step.
Dr Tenant Receivable / Cr Owner Funds Payable.
Browser roles cannot call this function. ADR-0010.';

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
  v_cash_id uuid;
  v_ar_id   uuid;
  v_ofp_id  uuid;
  v_mfr_id  uuid;
  v_vat_id  uuid;
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

  -- Dr Cash / Cr Tenant Receivable
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

  -- Commission split from OFP (same as OWNER_IS_CREDITOR)
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

comment on function public.gl_pm_post_collection_office_is_creditor(jsonb) is
'PM AGENT_NET / OFFICE_IS_CREDITOR: collection step.
Dr Cash / Cr Tenant Receivable; then Dr OFP / Cr MFR + VAT.
Browser roles cannot call this function. ADR-0010.';

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 3: gl_pm_accrue_fixed_monthly_fee
--
-- OWNER_AGENCY / FIXED_MONTHLY / DAILY_ACCRUAL
--
-- Posts a server-computed daily accrual entry for a management fee period.
-- The caller computes the number of days and gross daily rate; this RPC rounds
-- to 3dp and posts idempotently.
--
-- Entry:
--   Dr  1300 Due from Owners             accrual_amount
--     Cr  4100 Management Fee Revenue    accrual_net
--     Cr  2100 VAT Payable               vat_amount     (only when > 0)
--
-- Payload fields:
--   company_id        uuid
--   agreement_id      uuid    (source_id for idempotency)
--   accrual_period    text    (e.g. "2026-08-01/2026-08-31" — part of event_id)
--   accrual_net       numeric (>= 0, OMR 3dp)
--   vat_amount        numeric (optional, default 0)
--   effective_date    date
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
  v_due_id uuid;
  v_mfr_id uuid;
  v_vat_id uuid;
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

  -- Zero accrual is valid (e.g. 0-day periods) — idempotently post and return.
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

comment on function public.gl_pm_accrue_fixed_monthly_fee(jsonb) is
'PM AGENT_NET / FIXED_MONTHLY / DAILY_ACCRUAL.
Dr Due from Owners / Cr Management Fee Revenue [/ Cr VAT Payable].
Idempotent by (company_id, agreement_id, accrual_period).
No offsetting/netting without documented legal right. ADR-0010.';

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC 4: gl_pm_post_owner_payment
--
-- Pay owner: reduce Owner Funds Payable, credit Bank.
-- Uses the existing reservation links (owner_settlement_payment_links) to
-- ensure the settlement is not a Draft and that items are properly reserved.
--
-- Entry:
--   Dr  2000 Owner Funds Payable         net_payout
--     Cr  1120 Bank / 1111 Cash          net_payout
--
-- Payload fields:
--   company_id        uuid
--   settlement_id     text    (source_id — idempotency)
--   net_payout        numeric (> 0, OMR 3dp)
--   cash_account_no   text    (optional, default '1120')
--   effective_date    date
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
  v_ofp_id  uuid;
  v_cash_id uuid;
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

  -- Gate: settlement must be in PAID or APPROVED status (not DRAFT)
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

comment on function public.gl_pm_post_owner_payment(jsonb) is
'PM AGENT_NET: owner payout batch.
Dr Owner Funds Payable / Cr Bank.
Rejects DRAFT settlements. Idempotent by settlement_id.
Browser roles cannot call this function. ADR-0010.';

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
       and b.source_type like 'pm_%'
     order by b.effective_date desc, b.created_at desc
     limit p_limit
     offset p_offset;
end;
$fn$;

alter function public.gl_pm_list_batches(int,int) owner to postgres;
revoke all on function public.gl_pm_list_batches(int,int) from public, anon;
grant execute on function public.gl_pm_list_batches(int,int) to authenticated, service_role;

commit;
