-- ============================================================================
-- RC1 — Invoice credits reverse original economics and historical tax lineage
-- ============================================================================
--
-- A generic credit that debits 4000 is only correct for a source invoice that
-- actually credited 4000. RC1 owner-agency invoices do not do so. This forward
-- migration stores immutable controlled credit components and derives any GL
-- reversal from the source invoice batch, never from caller-selected accounts
-- or today's tax profile.
--
-- Existing posted rows are deliberately not rewritten. A legacy source with
-- insufficient lineage fails closed for new credit/payment activity and is
-- surfaced by the read-only RC1 diagnostic for governed S08/S09 review.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Controlled credit economic/tax lineage. Nullable additions preserve all
--    pre-RC1 posted history without pretending it had facts it did not store.
-- ---------------------------------------------------------------------------
alter table public.invoice_credits
  add column if not exists net_amount numeric(18,3),
  add column if not exists tax_amount numeric(18,3),
  add column if not exists tax_profile_id uuid
    references public.company_tax_profiles(id) on delete restrict,
  add column if not exists tax_snapshot_id uuid
    references public.taxable_line_tax_snapshots(id) on delete restrict,
  add column if not exists tax_code text,
  add column if not exists tax_rate numeric(6,3),
  add column if not exists tax_basis text,
  add column if not exists accounting_classification text,
  add column if not exists original_invoice_posting_batch_id uuid
    references public.journal_batches(id) on delete restrict;

alter table public.invoice_credits
  drop constraint if exists invoice_credits_components_omr_check;
alter table public.invoice_credits
  add constraint invoice_credits_components_omr_check check (
    (net_amount is null and tax_amount is null)
    or (
      net_amount >= 0
      and tax_amount >= 0
      and net_amount = round(net_amount, 3)
      and tax_amount = round(tax_amount, 3)
      and round(net_amount + tax_amount, 3) = round(amount, 3)
    )
  );

alter table public.invoice_credits
  drop constraint if exists invoice_credits_tax_basis_check;
alter table public.invoice_credits
  add constraint invoice_credits_tax_basis_check check (
    tax_basis is null or tax_basis in ('NET_PLUS_TAX', 'NON_TAXABLE')
  );

alter table public.invoice_credits
  drop constraint if exists invoice_credits_accounting_classification_check;
alter table public.invoice_credits
  add constraint invoice_credits_accounting_classification_check check (
    accounting_classification is null
    or accounting_classification in (
      'OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL',
      'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS',
      'LEGACY_SOURCE_BATCH_REVERSAL'
    )
  );

-- OWNER_IS_CREDITOR operational credits have no GL batch to reverse. Retain the
-- original strict requirement for a journal-backed credit, but permit the
-- append-only operational reversal shape as an explicitly null/null pair.
alter table public.invoice_credits
  drop constraint if exists invoice_credits_reversal_shape_chk;
alter table public.invoice_credits
  add constraint invoice_credits_reversal_shape_chk check (
    status <> 'REVERSED'
    or (
      reversal_request_id is not null
      and nullif(btrim(reversal_reason), '') is not null
      and reversed_by is not null
      and reversed_at is not null
      and (
        (journal_batch_id is null and reversal_journal_batch_id is null)
        or (journal_batch_id is not null and reversal_journal_batch_id is not null)
      )
    )
  );

create index if not exists invoice_credits_rc1_tax_lineage_idx
  on public.invoice_credits (company_id, invoice_id, status, created_at desc);

comment on column public.invoice_credits.net_amount is
  'Immutable RC1 credit net component derived from the original invoice economic basis.';
comment on column public.invoice_credits.tax_amount is
  'Immutable RC1 credit tax component derived from the original invoice tax snapshot, never from today''s rate.';
comment on column public.invoice_credits.original_invoice_posting_batch_id is
  'Immutable source invoice batch whose actual economic account lines are reversed for this credit; null only for operational OWNER_IS_CREDITOR invoices.';

-- ---------------------------------------------------------------------------
-- 2. Credit append-only guard. Reversal metadata is the only permitted update;
--    journal_batch_id may be populated once by the server immediately after the
--    canonical post_journal_event returns its batch id.
-- ---------------------------------------------------------------------------
create or replace function public.guard_invoice_credit_immutability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'INVOICE_CREDIT_HARD_DELETE_BLOCKED: credits are append-only; reverse the credit instead.'
      using errcode = '42501';
  end if;

  if old.company_id is distinct from new.company_id
     or old.invoice_id is distinct from new.invoice_id
     or old.amount is distinct from new.amount
     or old.credit_type is distinct from new.credit_type
     or old.reason is distinct from new.reason
     or old.reason_code is distinct from new.reason_code
     or old.effective_date is distinct from new.effective_date
     or old.created_by is distinct from new.created_by
     or old.created_at is distinct from new.created_at
     or old.request_id is distinct from new.request_id
     or old.net_amount is distinct from new.net_amount
     or old.tax_amount is distinct from new.tax_amount
     or old.tax_profile_id is distinct from new.tax_profile_id
     or old.tax_snapshot_id is distinct from new.tax_snapshot_id
     or old.tax_code is distinct from new.tax_code
     or old.tax_rate is distinct from new.tax_rate
     or old.tax_basis is distinct from new.tax_basis
     or old.accounting_classification is distinct from new.accounting_classification
     or old.original_invoice_posting_batch_id is distinct from new.original_invoice_posting_batch_id
     or old.reversal_of_id is distinct from new.reversal_of_id then
    raise exception 'INVOICE_CREDIT_IMMUTABLE: economic credit lineage cannot be changed after creation.'
      using errcode = '42501';
  end if;

  if old.journal_batch_id is not null
     and new.journal_batch_id is distinct from old.journal_batch_id then
    raise exception 'INVOICE_CREDIT_JOURNAL_IMMUTABLE' using errcode = '42501';
  end if;
  if old.journal_batch_id is null
     and new.journal_batch_id is not null
     and old.status <> 'POSTED' then
    raise exception 'INVOICE_CREDIT_JOURNAL_ASSIGNMENT_INVALID' using errcode = '42501';
  end if;

  if old.status = 'REVERSED' then
    raise exception 'INVOICE_CREDIT_ALREADY_REVERSED_IMMUTABLE' using errcode = '42501';
  end if;
  if old.status <> 'POSTED' or new.status not in ('POSTED', 'REVERSED') then
    raise exception 'INVOICE_CREDIT_STATUS_TRANSITION_INVALID' using errcode = '42501';
  end if;

  return new;
end;
$function$;

alter function public.guard_invoice_credit_immutability() owner to postgres;
revoke all on function public.guard_invoice_credit_immutability() from public, anon, authenticated;
drop trigger if exists trg_invoice_credit_immutability on public.invoice_credits;
create trigger trg_invoice_credit_immutability
before update or delete on public.invoice_credits
for each row execute function public.guard_invoice_credit_immutability();

-- ---------------------------------------------------------------------------
-- 3. Controlled credit creation. The function accepts only business fields;
--    accounts, tax rate, source batch and economic split are server-derived.
-- ---------------------------------------------------------------------------
create or replace function public.create_invoice_credit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_invoice_id uuid;
  v_amount numeric;
  v_credit_type text;
  v_reason text;
  v_reason_code text;
  v_request_id text;
  v_effective_date date;
  v_invoice public.invoices%rowtype;
  v_outstanding numeric;
  v_fingerprint text;
  v_cached_fingerprint text;
  v_cached_target text;
  v_existing jsonb;
  v_credit_id uuid := gen_random_uuid();
  v_batch_id uuid;
  v_original_batch_id uuid;
  v_source_batch_count integer := 0;
  v_classification text;
  v_taxable boolean := false;
  v_credit_tax numeric := 0;
  v_credit_net numeric := 0;
  v_prior_credit_amount numeric := 0;
  v_prior_credit_tax numeric := 0;
  v_prior_unclassified_tax_count integer := 0;
  v_ar_id text;
  v_source_ar_id text;
  v_source_ar_debit numeric := 0;
  v_source_non_tax_credit numeric := 0;
  v_source_tax_credit numeric := 0;
  v_source_debit_other numeric := 0;
  v_source_credit_other numeric := 0;
  v_remaining_non_tax numeric;
  v_target_portion numeric;
  v_target record;
  v_lines jsonb;
  v_post_result jsonb;
  v_result jsonb;
  v_credit_tax_snapshot_id uuid;
  v_period_id uuid;
  v_owner_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication is required to create invoice credits.' using errcode='42501';
  end if;
  if not coalesce(public.is_admin_or_manager(), false) and not coalesce(public.is_accountant(), false) then
    raise exception 'CREDIT_ROLE_REQUIRED: ADMIN, MANAGER or ACCOUNTANT role is required to create invoice credits.' using errcode='42501';
  end if;

  v_company_id := public.require_company_id();
  if p_payload ?| array['company_id','account_id','account_no','tax_rate','tax_code','tax_amount','journal_lines'] then
    raise exception 'CREDIT_SERVER_OWNED_ACCOUNTING_FIELDS_FORBIDDEN' using errcode='22023';
  end if;

  v_invoice_id := nullif(p_payload->>'invoice_id', '')::uuid;
  v_amount := public.gl_pm_round_omr(coalesce((p_payload->>'amount')::numeric, 0));
  v_credit_type := coalesce(nullif(p_payload->>'credit_type', ''), 'PARTIAL');
  v_reason := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  v_reason_code := nullif(p_payload->>'reason_code', '');
  v_request_id := nullif(p_payload->>'request_id', '');
  v_effective_date := coalesce(nullif(p_payload->>'effective_date', '')::date, current_date);
  if v_invoice_id is null or v_amount <= 0 or v_request_id is null or v_reason is null then
    raise exception 'CREDIT_REQUIRED: invoice_id, amount, reason and request_id are required.' using errcode='22023';
  end if;
  if v_credit_type not in ('PARTIAL','FULL') then
    raise exception 'CREDIT_TYPE_INVALID: credit_type must be PARTIAL or FULL.' using errcode='22023';
  end if;

  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'invoice_id', v_invoice_id::text,
    'amount', trim_scale(v_amount),
    'credit_type', v_credit_type,
    'reason', v_reason,
    'reason_code', v_reason_code,
    'effective_date', v_effective_date
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('invoice_credit:' || v_company_id::text || ':' || v_request_id, 0));

  select response_payload into v_existing
    from public.financial_operation_idempotency
   where operation_name = 'invoice_credit:' || v_company_id::text
     and request_id = v_request_id
   for update;
  if v_existing is not null then
    v_cached_fingerprint := v_existing->>'_fingerprint';
    v_cached_target := v_existing->>'_target';
    if v_cached_fingerprint is null or v_cached_target is null or not (v_existing ? 'response') then
      raise exception 'CREDIT_IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED' using errcode='22023';
    end if;
    if v_cached_fingerprint <> v_fingerprint or v_cached_target <> v_invoice_id::text then
      raise exception 'CREDIT_IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode='22023';
    end if;
    return v_existing->'response';
  end if;

  select * into v_invoice
    from public.invoices
   where id = v_invoice_id
     and company_id = v_company_id
     and deleted_at is null
   for update;
  if not found then
    raise exception 'CREDIT_INVOICE_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  if v_invoice.document_status <> 'POSTED' then
    raise exception 'CREDIT_INVOICE_NOT_POSTED: only posted invoices can be credited.' using errcode='22023';
  end if;

  select oa.owner_id into v_owner_id
    from public.owner_agreement_versions av
    join public.owner_agreements oa
      on oa.id = av.owner_agreement_id
     and oa.company_id = av.company_id
   where av.id = v_invoice.invoice_agreement_version_id
     and av.company_id = v_company_id;

  v_outstanding := public.gl_pm_round_omr(
    v_invoice.amount + coalesce(v_invoice.tax_amount, 0)
    - coalesce(v_invoice.paid_amount, 0)
    - coalesce(v_invoice.credited_amount, 0)
  );
  if v_amount > v_outstanding + 0.001 then
    raise exception 'CREDIT_EXCEEDS_OUTSTANDING: credit % exceeds eligible invoice outstanding %.', v_amount, v_outstanding using errcode='22023';
  end if;

  -- Period control applies to all credits, including the operational owner-
  -- creditor path that has no invoice GL batch. The resolver enforces OPEN /
  -- SOFT_CLOSED / HARD_CLOSED and late-posting policy without caller input.
  perform public.gl_ensure_initial_open_period(v_company_id, v_effective_date);
  select period_id into v_period_id
    from public.gl_resolve_accounting_period(v_company_id, v_effective_date);
  if v_period_id is null then
    raise exception 'CREDIT_ACCOUNTING_PERIOD_UNAVAILABLE' using errcode='P0001';
  end if;

  v_classification := v_invoice.invoice_accounting_classification;
  if v_classification = 'OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL' then
    v_original_batch_id := null;
  elsif v_classification = 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS' then
    v_original_batch_id := v_invoice.invoice_posting_batch_id;
    if v_original_batch_id is null then
      raise exception 'CREDIT_INVOICE_POSTING_LINEAGE_MISSING' using errcode='23514';
    end if;
  elsif v_classification is null then
    select count(*)::integer, min(b.id)
      into v_source_batch_count, v_original_batch_id
      from public.journal_batches b
     where b.company_id = v_company_id
       and b.source_type = 'invoice'
       and b.source_id = v_invoice_id::text;
    if v_source_batch_count <> 1 then
      raise exception 'CREDIT_LEGACY_INVOICE_LINEAGE_REVIEW_REQUIRED: historical invoice has no unique canonical source batch.'
        using errcode='23514';
    end if;
    v_classification := 'LEGACY_SOURCE_BATCH_REVERSAL';
  else
    raise exception 'CREDIT_INVOICE_ACCOUNTING_CLASSIFICATION_UNSUPPORTED' using errcode='23514';
  end if;

  -- Tax is derived from the original immutable invoice snapshot. Existing
  -- taxable rows without that snapshot are not guessed from a current profile.
  if v_invoice.tax_treatment in ('TAXABLE', 'NON_TAXABLE') then
    if v_invoice.tax_snapshot_id is null
       or v_invoice.tax_profile_id is null
       or v_invoice.tax_code is null
       or not exists (
         select 1 from public.taxable_line_tax_snapshots s
          where s.id = v_invoice.tax_snapshot_id
            and s.company_id = v_company_id
            and s.source_type = 'invoice'
            and s.source_id = v_invoice_id::text
            and s.tax_code = v_invoice.tax_code
            and s.tax_rate = v_invoice.tax_rate
            and s.net_amount = v_invoice.amount
            and s.tax_amount = v_invoice.tax_amount
       ) then
      raise exception 'CREDIT_TAX_LINEAGE_MISSING: invoice lacks immutable original profile/snapshot lineage.'
        using errcode='23514';
    end if;
    if v_invoice.tax_treatment = 'TAXABLE' then
      if v_invoice.tax_basis <> 'NET_PLUS_TAX' then
        raise exception 'CREDIT_TAXABLE_INVOICE_BASIS_INVALID' using errcode='23514';
      end if;
      v_taxable := true;
    elsif coalesce(v_invoice.tax_amount, 0) <> 0
       or coalesce(v_invoice.tax_rate, 0) <> 0
       or v_invoice.tax_code <> 'NON_TAXABLE'
       or v_invoice.tax_basis <> 'NON_TAXABLE' then
      raise exception 'CREDIT_NON_TAXABLE_INVOICE_TAX_INVALID' using errcode='23514';
    end if;
  elsif coalesce(v_invoice.tax_amount, 0) > 0 then
    raise exception 'CREDIT_LEGACY_TAX_LINEAGE_REVIEW_REQUIRED: historical taxable invoice cannot be credited without its original immutable tax snapshot.'
      using errcode='23514';
  end if;

  -- Tax credit allocation is based on cumulative original-invoice economics.
  -- The final credit receives the rounding residue so every sequence sums
  -- exactly to the original tax amount at OMR 3dp.
  select
    coalesce(sum(ic.amount) filter (where ic.status = 'POSTED'), 0),
    coalesce(sum(ic.tax_amount) filter (where ic.status = 'POSTED'), 0),
    count(*) filter (where ic.status = 'POSTED' and ic.tax_amount is null)
  into v_prior_credit_amount, v_prior_credit_tax, v_prior_unclassified_tax_count
  from public.invoice_credits ic
  where ic.company_id = v_company_id
    and ic.invoice_id = v_invoice_id;

  if v_taxable and (v_prior_unclassified_tax_count > 0 or abs(v_prior_credit_amount - coalesce(v_invoice.credited_amount, 0)) > 0.001) then
    raise exception 'CREDIT_EXISTING_TAX_LINEAGE_REVIEW_REQUIRED: prior credit rows lack immutable tax components.'
      using errcode='23514';
  end if;

  if v_taxable then
    if v_prior_credit_amount + v_amount >= v_invoice.amount + v_invoice.tax_amount - 0.001 then
      v_credit_tax := public.gl_pm_round_omr(v_invoice.tax_amount - v_prior_credit_tax);
    else
      v_credit_tax := public.gl_pm_round_omr(
        public.gl_pm_round_omr((v_prior_credit_amount + v_amount) * v_invoice.tax_amount / (v_invoice.amount + v_invoice.tax_amount))
        - v_prior_credit_tax
      );
    end if;
  end if;
  v_credit_net := public.gl_pm_round_omr(v_amount - v_credit_tax);

  -- For a journal-backed invoice, validate the original source economics and
  -- construct the controlled inverse using its actual credited accounts. The
  -- caller cannot nominate a GL account. This naturally reverses a historical
  -- 4000 source as 4000, while new owner-agency OFFICE sources reverse 2000.
  v_lines := '[]'::jsonb;
  if v_original_batch_id is not null then
    select
      coalesce(sum(jl.debit) filter (where a.no = '1201'), 0),
      coalesce(sum(jl.credit) filter (where a.no <> '2100'), 0),
      coalesce(sum(jl.credit) filter (where a.no = '2100'), 0),
      coalesce(sum(jl.debit) filter (where a.no <> '1201'), 0),
      coalesce(sum(jl.credit) filter (where a.no = '1201'), 0)
    into v_source_ar_debit, v_source_non_tax_credit, v_source_tax_credit,
         v_source_debit_other, v_source_credit_other
    from public.journal_lines jl
    join public.accounts a on a.id = jl.account_id and a.company_id = v_company_id
    join public.journal_batches b on b.id = jl.batch_id and b.company_id = v_company_id
    where jl.batch_id = v_original_batch_id
      and jl.company_id = v_company_id
      and b.status in ('POSTED','REVERSED');

    if round(v_source_ar_debit, 3) <> round(v_invoice.amount + coalesce(v_invoice.tax_amount,0), 3)
       or round(v_source_non_tax_credit, 3) <> round(v_invoice.amount, 3)
       or round(v_source_tax_credit, 3) <> round(coalesce(v_invoice.tax_amount,0), 3)
       or round(v_source_debit_other, 3) <> 0
       or round(v_source_credit_other, 3) <> 0 then
      raise exception 'CREDIT_SOURCE_ECONOMICS_UNSUPPORTED: source invoice must be a controlled Dr 1201 / Cr economic target (+2100) batch.'
        using errcode='23514';
    end if;

    select a.id into v_source_ar_id
      from public.journal_lines jl
      join public.accounts a on a.id = jl.account_id and a.company_id = v_company_id
     where jl.batch_id = v_original_batch_id
       and jl.company_id = v_company_id
       and a.no = '1201'
       and jl.debit > 0
     limit 1;
    if v_source_ar_id is null then
      raise exception 'CREDIT_SOURCE_AR_LINE_MISSING' using errcode='23514';
    end if;

    v_lines := jsonb_build_array(
      jsonb_build_object(
        'account_id', v_source_ar_id,
        'debit', 0,
        'credit', v_amount,
        'line_description', 'CREDIT-' || v_credit_id::text || '-CR-AR',
        'ref_source_id', v_invoice_id::text,
        'ref_entity_type', 'invoice',
        'ref_entity_id', v_invoice_id::text
      )
    );

    v_remaining_non_tax := v_credit_net;
    for v_target in
      select a.id as account_id, a.no as account_no, jl.credit as original_credit,
             row_number() over (order by a.no, a.id) as line_no,
             count(*) over () as line_count
        from public.journal_lines jl
        join public.accounts a on a.id = jl.account_id and a.company_id = v_company_id
       where jl.batch_id = v_original_batch_id
         and jl.company_id = v_company_id
         and jl.credit > 0
         and a.no <> '2100'
       order by a.no, a.id
    loop
      if v_target.line_no = v_target.line_count then
        v_target_portion := v_remaining_non_tax;
      else
        v_target_portion := public.gl_pm_round_omr(v_credit_net * v_target.original_credit / v_source_non_tax_credit);
        v_remaining_non_tax := public.gl_pm_round_omr(v_remaining_non_tax - v_target_portion);
      end if;
      if v_target_portion > 0 then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object(
            'account_id', v_target.account_id,
            'debit', v_target_portion,
            'credit', 0,
            'line_description', 'CREDIT-' || v_credit_id::text || '-DR-' || v_target.account_no,
            'ref_source_id', v_invoice_id::text,
            'ref_entity_type', 'invoice',
            'ref_entity_id', v_invoice_id::text
          )
        );
      end if;
    end loop;

    if v_credit_tax > 0 then
      select a.id into v_ar_id
        from public.journal_lines jl
        join public.accounts a on a.id = jl.account_id and a.company_id = v_company_id
       where jl.batch_id = v_original_batch_id
         and jl.company_id = v_company_id
         and a.no = '2100'
         and jl.credit > 0
       limit 1;
      if v_ar_id is null then
        raise exception 'CREDIT_SOURCE_VAT_LINE_MISSING' using errcode='23514';
      end if;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'account_id', v_ar_id,
          'debit', v_credit_tax,
          'credit', 0,
          'line_description', 'CREDIT-' || v_credit_id::text || '-DR-VAT',
          'ref_source_id', v_invoice_id::text,
          'ref_entity_type', 'invoice',
          'ref_entity_id', v_invoice_id::text
        )
      );
    end if;
  end if;

  insert into public.invoice_credits (
    id, company_id, invoice_id, amount, credit_type, reason, reason_code,
    effective_date, created_by, request_id, status,
    net_amount, tax_amount, tax_profile_id, tax_snapshot_id, tax_code, tax_rate,
    tax_basis, accounting_classification, original_invoice_posting_batch_id
  ) values (
    v_credit_id, v_company_id, v_invoice_id, v_amount, v_credit_type, v_reason, v_reason_code,
    v_effective_date, v_actor, v_request_id, 'POSTED',
    v_credit_net, v_credit_tax,
    v_invoice.tax_profile_id,
    v_invoice.tax_snapshot_id,
    v_invoice.tax_code,
    coalesce(v_invoice.tax_rate, 0),
    coalesce(v_invoice.tax_basis, case when v_taxable then 'NET_PLUS_TAX' else 'NON_TAXABLE' end),
    v_classification, v_original_batch_id
  );

  if v_original_batch_id is not null then
    v_post_result := public.post_journal_event(jsonb_build_object(
      'company_id', v_company_id,
      'source_type', 'invoice_credit',
      'source_id', v_invoice_id::text,
      'event_id', v_request_id,
      'effective_date', v_effective_date,
      'description', 'Invoice credit ' || v_credit_id::text || ' reverses original invoice economics',
      'lines', v_lines
    ));
    v_batch_id := nullif(v_post_result->>'batch_id', '')::uuid;
    if v_batch_id is null then
      raise exception 'CREDIT_POSTING_BATCH_MISSING' using errcode='P0001';
    end if;
    update public.invoice_credits
       set journal_batch_id = v_batch_id
     where id = v_credit_id;
  end if;

  if v_taxable then
    insert into public.taxable_line_tax_snapshots (
      company_id, source_type, source_id, journal_batch_id, account_no,
      tax_code, tax_rate, net_amount, tax_amount, effective_date
    ) values (
      v_company_id, 'invoice_credit', v_credit_id::text, v_batch_id, '2100',
      v_invoice.tax_code, v_invoice.tax_rate, v_credit_net, v_credit_tax, v_effective_date
    ) returning id into v_credit_tax_snapshot_id;
  end if;

  if v_classification = 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS' then
    if v_owner_id is null then
      raise exception 'CREDIT_OWNER_FUNDS_OWNER_REQUIRED' using errcode='23514';
    end if;
    insert into public.owner_funds_events (
      company_id, owner_id, contract_id, invoice_id, source_type, source_id,
      event_id, amount_delta, effective_date, journal_batch_id
    ) values (
      v_company_id, v_owner_id, v_invoice.contract_id, v_invoice_id,
      'INVOICE_CREDIT', v_credit_id::text, 'credit', -v_credit_net,
      v_effective_date, v_batch_id
    );
  end if;

  update public.invoices
     set credited_amount = public.gl_pm_round_omr(credited_amount + v_amount),
         updated_at = now()
   where id = v_invoice_id
     and company_id = v_company_id;
  perform public.recalculate_invoice_status(v_invoice_id);

  v_result := jsonb_build_object(
    'success', true,
    'credit_id', v_credit_id::text,
    'invoice_id', v_invoice_id::text,
    'amount', trim_scale(v_amount)::text,
    'net_amount', trim_scale(v_credit_net)::text,
    'tax_amount', trim_scale(v_credit_tax)::text,
    'credit_type', v_credit_type,
    'request_id', v_request_id,
    'batch_id', v_batch_id::text,
    'tax_posting_snapshot_id', v_credit_tax_snapshot_id::text,
    'outstanding_after', trim_scale(public.gl_pm_round_omr(v_outstanding - v_amount))::text
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values (
    'invoice_credit:' || v_company_id::text,
    v_request_id,
    jsonb_build_object('_fingerprint', v_fingerprint, '_target', v_invoice_id::text, 'response', v_result)
  );

  return v_result;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 4. Compensating credit reversal. A journal-backed credit reverses its own
--    batch; an operational OWNER_IS_CREDITOR credit has no invented GL entry.
-- ---------------------------------------------------------------------------
create or replace function public.reverse_invoice_credit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_credit_id uuid;
  v_reason text;
  v_request_id text;
  v_credit public.invoice_credits%rowtype;
  v_invoice public.invoices%rowtype;
  v_reversal_result jsonb;
  v_result jsonb;
  v_existing jsonb;
  v_period_id uuid;
  v_owner_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication is required to reverse invoice credits.' using errcode='42501';
  end if;
  if not coalesce(public.is_admin_or_manager(), false) and not coalesce(public.is_accountant(), false) then
    raise exception 'CREDIT_REVERSAL_ROLE_REQUIRED: ADMIN, MANAGER or ACCOUNTANT role is required.' using errcode='42501';
  end if;
  v_company_id := public.require_company_id();
  v_credit_id := nullif(p_payload->>'credit_id', '')::uuid;
  v_reason := nullif(btrim(coalesce(p_payload->>'reason', '')), '');
  v_request_id := nullif(p_payload->>'request_id', '');
  if v_credit_id is null or v_reason is null or v_request_id is null then
    raise exception 'CREDIT_REVERSAL_REQUIRED: credit_id, reason and request_id are required.' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('invoice_credit_reversal:' || v_company_id::text || ':' || v_request_id, 0));

  select response_payload into v_existing
    from public.financial_operation_idempotency
   where operation_name = 'invoice_credit_reversal:' || v_company_id::text
     and request_id = v_request_id
   for update;
  if v_existing is not null then
    if not (v_existing ? 'response') then
      raise exception 'CREDIT_REVERSAL_IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED' using errcode='22023';
    end if;
    return v_existing->'response';
  end if;

  select * into v_credit
    from public.invoice_credits
   where id = v_credit_id
     and company_id = v_company_id
   for update;
  if not found then
    raise exception 'CREDIT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  if v_credit.status <> 'POSTED' then
    raise exception 'CREDIT_ALREADY_REVERSED: only POSTED credits can be reversed.' using errcode='22023';
  end if;

  select * into v_invoice
    from public.invoices
   where id = v_credit.invoice_id
     and company_id = v_company_id
   for update;
  if not found then
    raise exception 'CREDIT_INVOICE_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
  end if;
  if v_invoice.credited_amount < v_credit.amount then
    raise exception 'CREDIT_REVERSAL_BALANCE_INVALID: credited balance is less than the credit amount.' using errcode='22023';
  end if;

  select oa.owner_id into v_owner_id
    from public.owner_agreement_versions av
    join public.owner_agreements oa
      on oa.id = av.owner_agreement_id
     and oa.company_id = av.company_id
   where av.id = v_invoice.invoice_agreement_version_id
     and av.company_id = v_company_id;

  perform public.gl_ensure_initial_open_period(v_company_id, coalesce(v_credit.effective_date, current_date));
  select period_id into v_period_id
    from public.gl_resolve_accounting_period(v_company_id, coalesce(v_credit.effective_date, current_date));
  if v_period_id is null then
    raise exception 'CREDIT_REVERSAL_ACCOUNTING_PERIOD_UNAVAILABLE' using errcode='P0001';
  end if;

  if v_credit.journal_batch_id is not null then
    v_reversal_result := public.reverse_journal_batch(v_credit.journal_batch_id);
  else
    v_reversal_result := jsonb_build_object('reversal_batch_id', null);
  end if;

  update public.invoices
     set credited_amount = public.gl_pm_round_omr(credited_amount - v_credit.amount),
         updated_at = now()
   where id = v_credit.invoice_id
     and company_id = v_company_id;
  perform public.recalculate_invoice_status(v_credit.invoice_id);

  update public.invoice_credits
     set status = 'REVERSED',
         reversal_request_id = v_request_id,
         reversal_journal_batch_id = nullif(v_reversal_result->>'reversal_batch_id', '')::uuid,
         reversal_reason = v_reason,
         reversed_by = v_actor,
         reversed_at = now()
   where id = v_credit_id;

  if v_credit.accounting_classification = 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS' then
    if v_owner_id is null then
      raise exception 'CREDIT_REVERSAL_OWNER_FUNDS_OWNER_REQUIRED' using errcode='23514';
    end if;
    insert into public.owner_funds_events (
      company_id, owner_id, contract_id, invoice_id, source_type, source_id,
      event_id, amount_delta, effective_date, journal_batch_id
    ) values (
      v_company_id, v_owner_id, v_invoice.contract_id, v_invoice.id,
      'INVOICE_CREDIT_REVERSAL', v_credit_id::text, v_request_id,
      v_credit.net_amount, v_credit.effective_date,
      nullif(v_reversal_result->>'reversal_batch_id', '')::uuid
    );
  end if;

  v_result := jsonb_build_object(
    'success', true,
    'credit_id', v_credit_id::text,
    'reversal_request_id', v_request_id,
    'reversal_batch_id', v_reversal_result->>'reversal_batch_id'
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('invoice_credit_reversal:' || v_company_id::text, v_request_id, jsonb_build_object('response', v_result));

  return v_result;
end;
$function$;

alter function public.create_invoice_credit_atomic(jsonb) owner to postgres;
revoke all on function public.create_invoice_credit_atomic(jsonb) from public, anon;
grant execute on function public.create_invoice_credit_atomic(jsonb) to authenticated, service_role;
alter function public.reverse_invoice_credit_atomic(jsonb) owner to postgres;
revoke all on function public.reverse_invoice_credit_atomic(jsonb) from public, anon;
grant execute on function public.reverse_invoice_credit_atomic(jsonb) to authenticated, service_role;

comment on function public.create_invoice_credit_atomic(jsonb) is
  'RC1 controlled credit. Reverses the original invoice source economics and original tax snapshot; callers never choose accounts or current tax rates.';
comment on function public.reverse_invoice_credit_atomic(jsonb) is
  'RC1 compensating reversal of a controlled invoice credit. Journal-backed credits reverse their original credit batch; operational owner-creditor credits reverse operationally only.';

commit;
