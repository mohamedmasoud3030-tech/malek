-- Extend an active Short Stay before checkout without rewriting its original
-- posted invoice. The extension adds a separately auditable RENT obligation
-- for the added period while contract.rent_amount becomes the cumulative
-- agreed stay total.
--
-- Authority remains explicit: contract edit + invoice generation are both
-- required because extending the stay changes a signed commercial term and
-- creates a financial obligation.
--
-- ALLOW_GOVERNED_DATA_MIGRATION
-- Governance note: every transactional INSERT token in this migration is inside
-- the SECURITY DEFINER extend_short_stay_contract_atomic RPC body. The migration
-- performs no raw business-data INSERT/backfill at migration time. Runtime writes
-- remain company-scoped, permission-gated, idempotent, period-checked, journaled,
-- and auditable through this atomic command boundary.

begin;

create or replace function public.extend_short_stay_contract_atomic(
  p_contract_id uuid,
  p_new_end_date date,
  p_extension_amount numeric,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_actor uuid := auth.uid();
  v_contract public.contracts%rowtype;
  v_owner_id uuid;
  v_old_end date;
  v_new_total numeric;
  v_invoice_id uuid;
  v_batch_id uuid;
  v_tax_snapshot_id uuid;
  v_tax_profile_id uuid;
  v_tax_code text;
  v_tax_rate numeric := 0;
  v_tax_amount numeric := 0;
  v_total_amount numeric := 0;
  v_taxable boolean;
  v_classification text;
  v_ar_account_id text;
  v_owner_funds_account_id text;
  v_vat_account_id text;
  v_lines jsonb;
  v_post_result jsonb;
  v_operation_name text;
  v_fingerprint text;
  v_cached jsonb;
  v_cached_fingerprint text;
  v_result jsonb;
begin
  if v_actor is null
     or not public.is_company_member(v_company, v_actor)
     or not public.current_user_has_effective_app_permission('contracts.write')
     or not public.current_user_has_effective_app_permission('financial.invoices.generate') then
    raise exception 'SHORT_STAY_EXTENSION_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  if p_contract_id is null
     or p_request_id is null
     or p_new_end_date is null
     or p_extension_amount is null
     or p_extension_amount <= 0
     or round(p_extension_amount, 3) <> p_extension_amount then
    raise exception 'SHORT_STAY_EXTENSION_INPUT_INVALID' using errcode = '22023';
  end if;

  v_operation_name := 'extend_short_stay_contract_atomic:' || v_company::text;
  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'contract_id', p_contract_id,
    'new_end_date', p_new_end_date,
    'extension_amount', p_extension_amount
  )::text, 'UTF8')), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(v_operation_name || ':' || p_request_id::text, 0));

  select response_payload
    into v_cached
  from public.financial_operation_idempotency
  where operation_name = v_operation_name
    and request_id = p_request_id::text
  for update;

  if v_cached is not null then
    v_cached_fingerprint := v_cached->>'_request_fingerprint';
    if v_cached_fingerprint is distinct from v_fingerprint or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode = '22023';
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  select *
    into v_contract
  from public.contracts c
  where c.id = p_contract_id
    and c.company_id = v_company
    and c.deleted_at is null
  for update;

  if not found then
    raise exception 'SHORT_STAY_CONTRACT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if coalesce(lower(v_contract.lease_mode), 'long_term') <> 'short_stay'
     or lower(v_contract.status::text) <> 'active' then
    raise exception 'SHORT_STAY_EXTENSION_REQUIRES_ACTIVE_SHORT_STAY' using errcode = '23514';
  end if;

  v_old_end := v_contract.end_date;
  -- Checkout date is exclusive operationally. Extension must be agreed before
  -- that date, not after an automatically-expired stay.
  if current_date >= v_old_end then
    raise exception 'SHORT_STAY_EXTENSION_TOO_LATE' using errcode = '23514';
  end if;
  if p_new_end_date <= v_old_end then
    raise exception 'SHORT_STAY_EXTENSION_MUST_MOVE_END_FORWARD' using errcode = '23514';
  end if;

  if v_contract.unit_id is null then
    raise exception 'SHORT_STAY_EXTENSION_UNIT_REQUIRED' using errcode = '23514';
  end if;

  -- No extension may consume dates already promised to another live contract.
  if exists (
    select 1
    from public.contracts other_contract
    where other_contract.company_id = v_company
      and other_contract.unit_id = v_contract.unit_id
      and other_contract.id <> v_contract.id
      and other_contract.deleted_at is null
      and lower(other_contract.status::text) in ('active', 'draft')
      and other_contract.start_date < p_new_end_date
      and other_contract.end_date > v_old_end
  ) then
    raise exception 'SHORT_STAY_EXTENSION_OVERLAPS_ANOTHER_CONTRACT' using errcode = '23P01';
  end if;

  if v_contract.agreement_id is null or not exists (
    select 1
    from public.owner_agreements agreement_record
    where agreement_record.id = v_contract.agreement_id
      and agreement_record.company_id = v_company
      and agreement_record.property_id = v_contract.property_id
      and agreement_record.starts_on <= v_contract.start_date
      and (agreement_record.ends_on is null or agreement_record.ends_on >= p_new_end_date)
  ) then
    raise exception 'SHORT_STAY_EXTENSION_OWNER_AGREEMENT_COVERAGE_REQUIRED' using errcode = '23514';
  end if;

  if v_contract.operating_model_snapshot is distinct from 'OWNER_AGENCY'
     or v_contract.agreement_version_id is null
     or v_contract.collection_role_snapshot not in ('OWNER_IS_CREDITOR', 'OFFICE_IS_CREDITOR') then
    raise exception 'SHORT_STAY_EXTENSION_ACCOUNTING_MODEL_UNAVAILABLE' using errcode = '23514';
  end if;

  select oa.owner_id
    into v_owner_id
  from public.owner_agreements oa
  where oa.id = v_contract.agreement_id
    and oa.company_id = v_company;
  if v_owner_id is null then
    raise exception 'SHORT_STAY_EXTENSION_OWNER_REQUIRED' using errcode = '23514';
  end if;

  -- One obligation per extension period. This is also a defensive guard on top
  -- of request idempotency.
  if exists (
    select 1
    from public.invoices i
    where i.company_id = v_company
      and i.contract_id = v_contract.id
      and i.charge_type = 'RENT'
      and i.billing_period_start = v_old_end
      and i.deleted_at is null
      and i.document_status not in ('VOIDED', 'REVERSED')
  ) then
    raise exception 'SHORT_STAY_EXTENSION_PERIOD_ALREADY_INVOICED' using errcode = '23505';
  end if;

  v_classification := case v_contract.collection_role_snapshot
    when 'OWNER_IS_CREDITOR' then 'OWNER_AGENCY_OWNER_CREDITOR_OPERATIONAL'
    when 'OFFICE_IS_CREDITOR' then 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS'
    else null
  end;

  select profile_id, tax_code, tax_rate
    into v_tax_profile_id, v_tax_code, v_tax_rate
  from public.resolve_active_tax_profile(v_company, current_date);
  v_taxable := v_tax_code <> 'NON_TAXABLE';
  v_tax_amount := public.compute_tax_amount(p_extension_amount, v_tax_rate);
  if not v_taxable and (v_tax_rate <> 0 or v_tax_amount <> 0) then
    raise exception 'SHORT_STAY_EXTENSION_NON_TAXABLE_RATE_INVALID' using errcode = '23514';
  end if;
  v_total_amount := public.gl_pm_round_omr(p_extension_amount + v_tax_amount);

  -- Validate the current accounting period before changing the contract so a
  -- closed-period failure leaves both operational and financial state intact.
  perform public.gl_ensure_initial_open_period(v_company, current_date);
  perform 1 from public.gl_resolve_accounting_period(v_company, current_date);

  v_new_total := public.gl_pm_round_omr(v_contract.rent_amount + p_extension_amount);

  update public.contracts
     set end_date = p_new_end_date,
         rent_amount = v_new_total,
         updated_at = now()
   where id = v_contract.id
     and company_id = v_company;

  insert into public.invoices (
    contract_id,
    issue_date,
    due_date,
    amount,
    tax_amount,
    tax_rate,
    status,
    company_id,
    document_status,
    charge_type,
    billing_period_start,
    billing_period_end,
    invoice_agreement_version_id,
    invoice_operating_model,
    invoice_collection_role,
    invoice_accounting_classification,
    tax_treatment,
    tax_profile_id,
    tax_code,
    tax_basis
  ) values (
    v_contract.id,
    current_date,
    current_date + coalesce(v_contract.grace_days, 0),
    p_extension_amount,
    v_tax_amount,
    v_tax_rate,
    'UNPAID',
    v_company,
    'DRAFT',
    'RENT',
    v_old_end,
    p_new_end_date,
    v_contract.agreement_version_id,
    v_contract.operating_model_snapshot,
    v_contract.collection_role_snapshot,
    v_classification,
    case when v_taxable then 'TAXABLE' else 'NON_TAXABLE' end,
    v_tax_profile_id,
    v_tax_code,
    case when v_taxable then 'NET_PLUS_TAX' else 'NON_TAXABLE' end
  ) returning id into v_invoice_id;

  v_batch_id := null;
  if v_classification = 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS' then
    v_ar_account_id := public.require_company_account_id(v_company, '1201');
    v_owner_funds_account_id := public.require_company_account_id(v_company, '2000');
    v_lines := jsonb_build_array(
      jsonb_build_object(
        'account_id', v_ar_account_id,
        'debit', v_total_amount,
        'credit', 0,
        'line_description', 'INV-' || v_invoice_id::text || '-DR-AR',
        'ref_source_id', v_invoice_id::text,
        'ref_entity_type', 'invoice',
        'ref_entity_id', v_invoice_id::text
      ),
      jsonb_build_object(
        'account_id', v_owner_funds_account_id,
        'debit', 0,
        'credit', p_extension_amount,
        'line_description', 'INV-' || v_invoice_id::text || '-CR-OWNER-FUNDS',
        'ref_source_id', v_invoice_id::text,
        'ref_entity_type', 'invoice',
        'ref_entity_id', v_invoice_id::text
      )
    );
    if v_tax_amount > 0 then
      v_vat_account_id := public.require_company_account_id(v_company, '2100');
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'account_id', v_vat_account_id,
          'debit', 0,
          'credit', v_tax_amount,
          'line_description', 'INV-' || v_invoice_id::text || '-CR-VAT',
          'ref_source_id', v_invoice_id::text,
          'ref_entity_type', 'invoice',
          'ref_entity_id', v_invoice_id::text
        )
      );
    end if;

    v_post_result := public.post_journal_event(jsonb_build_object(
      'company_id', v_company,
      'source_type', 'invoice',
      'source_id', v_invoice_id::text,
      'event_id', v_invoice_id::text,
      'effective_date', current_date,
      'description', 'OWNER_AGENCY OFFICE_IS_CREDITOR short-stay extension invoice ' || v_invoice_id::text,
      'lines', v_lines
    ));
    v_batch_id := nullif(v_post_result->>'batch_id', '')::uuid;
    if v_batch_id is null then
      raise exception 'SHORT_STAY_EXTENSION_POSTING_BATCH_MISSING' using errcode = 'P0001';
    end if;
  end if;

  insert into public.taxable_line_tax_snapshots (
    company_id,
    source_type,
    source_id,
    journal_batch_id,
    account_no,
    tax_code,
    tax_rate,
    net_amount,
    tax_amount,
    effective_date
  ) values (
    v_company,
    'invoice',
    v_invoice_id::text,
    v_batch_id,
    '2100',
    v_tax_code,
    v_tax_rate,
    p_extension_amount,
    v_tax_amount,
    current_date
  ) returning id into v_tax_snapshot_id;

  update public.invoices
     set invoice_posting_batch_id = v_batch_id,
         tax_snapshot_id = v_tax_snapshot_id,
         document_status = 'POSTED',
         updated_at = now()
   where id = v_invoice_id
     and company_id = v_company;

  if v_classification = 'OWNER_AGENCY_OFFICE_CREDITOR_AR_OWNER_FUNDS' then
    insert into public.owner_funds_events (
      company_id, owner_id, contract_id, invoice_id, source_type, source_id,
      event_id, amount_delta, effective_date, journal_batch_id
    ) values (
      v_company, v_owner_id, v_contract.id, v_invoice_id, 'OFFICE_INVOICE',
      v_invoice_id::text, 'issue', p_extension_amount, current_date, v_batch_id
    );
  end if;

  insert into public.audit_log (
    id, ts, user_id, username, action, entity, entity_id, note, "table", details, created_at
  ) values (
    gen_random_uuid()::text,
    extract(epoch from now())::bigint,
    v_actor,
    (select email from auth.users where id = v_actor),
    'EXTEND_SHORT_STAY',
    'contracts',
    v_contract.id::text,
    'Short Stay extended before checkout with a supplemental canonical rent invoice',
    'contracts',
    jsonb_build_object(
      'old_end_date', v_old_end,
      'new_end_date', p_new_end_date,
      'extension_amount', p_extension_amount,
      'new_contract_total', v_new_total,
      'invoice_id', v_invoice_id,
      'request_id', p_request_id
    )::text,
    now()
  );

  v_result := jsonb_build_object(
    'status', 'extended',
    'contract_id', v_contract.id,
    'old_end_date', v_old_end,
    'new_end_date', p_new_end_date,
    'extension_amount', p_extension_amount,
    'new_contract_total', v_new_total,
    'invoice_id', v_invoice_id,
    'idempotent', false
  );

  insert into public.financial_operation_idempotency (
    operation_name, request_id, response_payload
  ) values (
    v_operation_name,
    p_request_id::text,
    jsonb_build_object('_request_fingerprint', v_fingerprint, 'response', v_result)
  );

  return v_result;
end;
$function$;

revoke all on function public.extend_short_stay_contract_atomic(uuid,date,numeric,uuid) from public, anon;
grant execute on function public.extend_short_stay_contract_atomic(uuid,date,numeric,uuid) to authenticated;

commit;
