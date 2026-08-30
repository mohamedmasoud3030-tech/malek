-- Avoid re-entering owner_funds_events INSERT guards for an application event
-- that already exists when a deposit claim transitions from APPLIED to REVERSED.
--
-- PostgreSQL BEFORE INSERT triggers run before ON CONFLICT DO NOTHING resolves a
-- duplicate. During reversal, the new reversal journal batch already exists and
-- is intentionally waiting for its matching Owner Funds event. Re-attempting
-- the old application event first therefore makes the cutover guard see the
-- reversal batch as temporarily untracked and fail closed.
--
-- Check existence before INSERT instead. This preserves the same economic
-- identity and lets the trigger append only the genuinely-new reversal event.

begin;

create or replace function app_private.capture_deposit_claim_owner_funds_lineage()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_owner_id uuid;
  v_contract_id uuid;
  v_invoice_id uuid;
  v_reversal_effective_date date;
begin
  if new.target_account_no is distinct from '2000' then
    return new;
  end if;

  select c.id, oa.owner_id
    into v_contract_id, v_owner_id
  from public.contracts c
  join public.owner_agreements oa
    on oa.id = c.agreement_id
   and oa.company_id = c.company_id
  where c.id::text = new.contract_id
    and c.company_id = new.company_id
    and c.deleted_at is null;

  if v_contract_id is null or v_owner_id is null then
    raise exception 'DEPOSIT_CLAIM_OWNER_FUNDS_LINEAGE_OWNER_REQUIRED'
      using errcode = '23514';
  end if;

  v_invoice_id := nullif(new.invoice_id, '')::uuid;

  if new.status in ('APPLIED', 'REVERSED') then
    if new.application_journal_batch_id is null
       or new.application_effective_date is null then
      raise exception 'DEPOSIT_CLAIM_OWNER_FUNDS_APPLICATION_LINEAGE_REQUIRED'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.owner_funds_events event_record
      where event_record.company_id = new.company_id
        and event_record.source_type = 'DEPOSIT_CLAIM_APPLICATION'
        and event_record.source_id = new.id::text
        and event_record.event_id = 'apply'
    ) then
      insert into public.owner_funds_events (
        company_id,
        owner_id,
        contract_id,
        invoice_id,
        source_type,
        source_id,
        event_id,
        amount_delta,
        effective_date,
        journal_batch_id
      ) values (
        new.company_id,
        v_owner_id,
        v_contract_id,
        v_invoice_id,
        'DEPOSIT_CLAIM_APPLICATION',
        new.id::text,
        'apply',
        public.gl_pm_round_omr(new.allocation_amount),
        new.application_effective_date,
        new.application_journal_batch_id
      );
    end if;
  end if;

  if new.status = 'REVERSED' then
    if new.reversal_journal_batch_id is null then
      raise exception 'DEPOSIT_CLAIM_OWNER_FUNDS_REVERSAL_LINEAGE_REQUIRED'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.owner_funds_events event_record
      where event_record.company_id = new.company_id
        and event_record.source_type = 'DEPOSIT_CLAIM_REVERSAL'
        and event_record.source_id = new.id::text
        and event_record.event_id = 'reverse'
    ) then
      select jb.effective_date
        into v_reversal_effective_date
      from public.journal_batches jb
      where jb.id = new.reversal_journal_batch_id
        and jb.company_id = new.company_id;

      if v_reversal_effective_date is null then
        raise exception 'DEPOSIT_CLAIM_OWNER_FUNDS_REVERSAL_BATCH_INVALID'
          using errcode = '23514';
      end if;

      insert into public.owner_funds_events (
        company_id,
        owner_id,
        contract_id,
        invoice_id,
        source_type,
        source_id,
        event_id,
        amount_delta,
        effective_date,
        journal_batch_id
      ) values (
        new.company_id,
        v_owner_id,
        v_contract_id,
        v_invoice_id,
        'DEPOSIT_CLAIM_REVERSAL',
        new.id::text,
        'reverse',
        -public.gl_pm_round_omr(new.allocation_amount),
        v_reversal_effective_date,
        new.reversal_journal_batch_id
      );
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function app_private.capture_deposit_claim_owner_funds_lineage()
  from public, anon, authenticated;

comment on function app_private.capture_deposit_claim_owner_funds_lineage() is
  'Invariant boundary: append each owner-targeted deposit claim application/reversal exactly once without re-entering owner-funds guards for an existing event.';

commit;
