-- FIN-009 / SEC-002: one governed deposit receipt command.
-- Proven defects: omitted client context persisted NULL relationships; supplied
-- context could disagree with the contract; cached requests ignored changed
-- amounts; cache lookup ran before its advisory lock.
-- Keep the existing public signature, ACL, company/role boundary, journal engine
-- and deposit transaction append. Derive context server-side; validate retries.
-- No historical data rewrite or production operation. Hosted deployment still
-- requires authorized migration/ACL parity verification.

begin;

CREATE OR REPLACE FUNCTION "public"."create_deposit_atomic"("p_payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_actor uuid := auth.uid();
  v_company uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_contract_id text := nullif(p_payload->>'contract_id', '');
  v_tenant_id text := nullif(p_payload->>'tenant_id', '');
  v_property_id text := nullif(p_payload->>'property_id', '');
  v_unit_id text := nullif(p_payload->>'unit_id', '');
  v_amount numeric := round(coalesce(nullif(p_payload->>'amount', '')::numeric, 0), 3);
  v_received_date date := coalesce(nullif(p_payload->>'received_date', '')::date, current_date);
  v_notes text := nullif(p_payload->>'notes', '');
  v_deposit_id uuid := gen_random_uuid();
  v_cached jsonb;
  v_contract_company uuid;
  v_contract_tenant uuid;
  v_contract_property uuid;
  v_contract_unit uuid;
  v_fingerprint jsonb;
  v_previous public.tenant_deposits%rowtype;
  v_kernel jsonb;
  v_result jsonb;
  v_operation_name text;
begin
  if v_actor is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'ADMIN or MANAGER role required' using errcode = '42501';
  end if;
  v_company := public.require_company_id();

  if v_request_id is null then
    v_request_id := gen_random_uuid()::text;
  end if;

  -- Lock before lookup: concurrent retries must observe the committed cache,
  -- not both post before a final ON CONFLICT silently drops one cache insert.
  v_operation_name := 'create_deposit_atomic:' || v_company::text;
  perform pg_advisory_xact_lock(hashtextextended(v_operation_name || ':' || v_request_id, 0));
  v_fingerprint := jsonb_build_object('contract_id', v_contract_id, 'amount', v_amount,
    'received_date', v_received_date, 'notes', v_notes);
  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = v_operation_name and request_id = v_request_id;
  if v_cached is not null then
    if not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED' using errcode = '22023';
    end if;
    if v_cached ? 'fingerprint' then
      if v_cached->'fingerprint' is distinct from v_fingerprint then
        raise exception 'DEPOSIT_CREATE_IDEMPOTENCY_CONFLICT' using errcode = '22023';
      end if;
    else
      -- Verify old cache entries against immutable receipt fields, without
      -- inventing a fingerprint or rewriting historical deposit records.
      select * into v_previous from public.tenant_deposits
        where id = v_cached->'response'->>'deposit_id' and company_id = v_company;
      if not found or v_previous.contract_id::text is distinct from v_contract_id
        or v_previous.deposit_amount is distinct from v_amount
        or v_previous.received_date is distinct from v_received_date
        or v_previous.notes is distinct from v_notes then
        raise exception 'DEPOSIT_CREATE_HISTORICAL_REPLAY_UNVERIFIED' using errcode = '22023';
      end if;
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  if v_contract_id is null then
    raise exception 'contract_id required' using errcode = '22023';
  end if;
  if v_contract_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'contract_id is not a valid identifier' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 or v_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'amount must be >0' using errcode = '22023';
  end if;

  -- Company isolation: the contract must belong to the caller's company.
  select c.company_id, c.tenant_id, c.property_id, c.unit_id
    into v_contract_company, v_contract_tenant, v_contract_property, v_contract_unit
  from public.contracts c
  where c.id = v_contract_id::uuid
    and c.deleted_at is null;
  if v_contract_company is null or v_contract_company <> v_company then
    raise exception 'Contract not found in current company.' using errcode = '42501';
  end if;

  -- Contract is the relationship authority. Older callers may still send
  -- these fields, but cannot redirect a deposit to another party/property/unit.
  if (v_tenant_id is not null and v_tenant_id is distinct from v_contract_tenant::text)
    or (v_property_id is not null and v_property_id is distinct from v_contract_property::text)
    or (v_unit_id is not null and v_unit_id is distinct from v_contract_unit::text) then
    raise exception 'DEPOSIT_CREATE_CONTRACT_CONTEXT_MISMATCH' using errcode = '22023';
  end if;
  v_tenant_id := v_contract_tenant::text;
  v_property_id := v_contract_property::text;
  v_unit_id := v_contract_unit::text;

  insert into public.tenant_deposits (
    id, contract_id, tenant_id, property_id, unit_id,
    deposit_amount, deducted_amount, refunded_amount, remaining_amount,
    status, received_date, notes, request_id, company_id
  ) values (
    v_deposit_id, v_contract_id::uuid, nullif(v_tenant_id, ''),
    nullif(v_property_id, '')::uuid, nullif(v_unit_id, '')::uuid,
    v_amount, 0, 0, v_amount,
    'held', v_received_date, v_notes, v_request_id, v_company
  );

  -- GL through the canonical engine: Dr 1111 / Cr 2200 with full provenance.
  v_kernel := public.gl_pm_post_deposit_receipt(jsonb_build_object(
    'company_id', v_company,
    'deposit_id', v_deposit_id,
    'amount', v_amount,
    'cash_account_no', '1111',
    'effective_date', v_received_date
  ));

  -- Append-only held transaction, batch-linked from the start.
  insert into public.deposit_transactions (
    deposit_id, type, amount, reason, description, request_id, company_id, journal_batch_id
  ) values (
    v_deposit_id::text, 'held', v_amount, 'initial_deposit',
    'استلام وديعة تأمين', v_request_id || '-held', v_company,
    (v_kernel->'batch'->>'batch_id')::uuid
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'deposit_id', v_deposit_id,
    'request_id', v_request_id,
    'amount', v_amount,
    'journal_batch_id', (v_kernel->'batch'->>'batch_id')::uuid
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values (v_operation_name, v_request_id, jsonb_build_object('response', v_result, 'fingerprint', v_fingerprint))
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$_$;

commit;
