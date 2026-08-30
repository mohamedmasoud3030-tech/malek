-- Preserve Owner Funds Payable (2000) subledger lineage when an approved
-- tenant-deposit claim is applied to, or reversed from, an owner obligation.
--
-- Defect:
-- apply_deposit_claim_atomic() correctly posts the deposit application to the
-- GL, but an owner-targeted claim (target_account_no = '2000') did not append
-- the corresponding owner_funds_events row. The next governed owner-funds
-- mutation therefore saw that otherwise-valid 2000 journal batch as historical
-- untracked activity and failed closed with OWNER_FUNDS_CUTOVER_REVIEW_REQUIRED.
--
-- Enforcement strategy:
-- keep the existing deposit RPCs as the command authority and capture the
-- subledger event at the deposit_application_claims state boundary. The trigger
-- runs in the same transaction after APPLIED/REVERSED state is written, so a
-- lineage failure aborts the whole command atomically. This also protects future
-- command implementations from silently omitting the Owner Funds subledger.
--
-- ALLOW_GOVERNED_DATA_MIGRATION
-- The two INSERT ... SELECT statements at the end only backfill canonical
-- APPLIED/REVERSED deposit claims that already carry immutable journal-batch
-- lineage. Company, owner, contract, invoice and batch identity are all derived
-- from existing governed rows; no business amount is invented by this migration.

begin;

alter table public.owner_funds_events
  drop constraint if exists owner_funds_events_source_type_check;

alter table public.owner_funds_events
  add constraint owner_funds_events_source_type_check
  check (source_type = any (array[
    'OFFICE_INVOICE'::text,
    'OWNER_COLLECTION'::text,
    'MANAGEMENT_FEE'::text,
    'INVOICE_CREDIT'::text,
    'INVOICE_CREDIT_REVERSAL'::text,
    'RECEIPT_VOID_REVERSAL'::text,
    'OWNER_SETTLEMENT_PAYOUT'::text,
    'OWNER_OFFSET'::text,
    'OWNER_OFFSET_REVERSAL'::text,
    'DEPOSIT_CLAIM_APPLICATION'::text,
    'DEPOSIT_CLAIM_REVERSAL'::text
  ]));

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
    )
    on conflict (company_id, source_type, source_id, event_id) do nothing;
  end if;

  if new.status = 'REVERSED' then
    if new.reversal_journal_batch_id is null then
      raise exception 'DEPOSIT_CLAIM_OWNER_FUNDS_REVERSAL_LINEAGE_REQUIRED'
        using errcode = '23514';
    end if;

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
    )
    on conflict (company_id, source_type, source_id, event_id) do nothing;
  end if;

  return new;
end;
$function$;

revoke all on function app_private.capture_deposit_claim_owner_funds_lineage()
  from public, anon, authenticated;

drop trigger if exists trg_deposit_claim_owner_funds_lineage
  on public.deposit_application_claims;

create trigger trg_deposit_claim_owner_funds_lineage
after insert or update of status, application_journal_batch_id, reversal_journal_batch_id
on public.deposit_application_claims
for each row
execute function app_private.capture_deposit_claim_owner_funds_lineage();

-- Backfill already-applied owner-targeted claims from their immutable canonical
-- journal batches. The owner is resolved from the contract's owner agreement;
-- the amount and effective date come from the governed claim itself.
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
)
select
  claim.company_id,
  agreement.owner_id,
  contract_record.id,
  nullif(claim.invoice_id, '')::uuid,
  'DEPOSIT_CLAIM_APPLICATION',
  claim.id::text,
  'apply',
  public.gl_pm_round_omr(claim.allocation_amount),
  claim.application_effective_date,
  claim.application_journal_batch_id
from public.deposit_application_claims claim
join public.contracts contract_record
  on contract_record.id::text = claim.contract_id
 and contract_record.company_id = claim.company_id
join public.owner_agreements agreement
  on agreement.id = contract_record.agreement_id
 and agreement.company_id = claim.company_id
where claim.target_account_no = '2000'
  and claim.status in ('APPLIED', 'REVERSED')
  and claim.application_journal_batch_id is not null
  and claim.application_effective_date is not null
on conflict (company_id, source_type, source_id, event_id) do nothing;

-- A reversed claim carries a separate canonical reversal journal batch. Record
-- the compensating Owner Funds movement using that batch's own effective date.
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
)
select
  claim.company_id,
  agreement.owner_id,
  contract_record.id,
  nullif(claim.invoice_id, '')::uuid,
  'DEPOSIT_CLAIM_REVERSAL',
  claim.id::text,
  'reverse',
  -public.gl_pm_round_omr(claim.allocation_amount),
  reversal_batch.effective_date,
  claim.reversal_journal_batch_id
from public.deposit_application_claims claim
join public.contracts contract_record
  on contract_record.id::text = claim.contract_id
 and contract_record.company_id = claim.company_id
join public.owner_agreements agreement
  on agreement.id = contract_record.agreement_id
 and agreement.company_id = claim.company_id
join public.journal_batches reversal_batch
  on reversal_batch.id = claim.reversal_journal_batch_id
 and reversal_batch.company_id = claim.company_id
where claim.target_account_no = '2000'
  and claim.status = 'REVERSED'
  and claim.reversal_journal_batch_id is not null
on conflict (company_id, source_type, source_id, event_id) do nothing;

comment on function app_private.capture_deposit_claim_owner_funds_lineage() is
  'Invariant boundary: every governed deposit claim that changes Owner Funds Payable (2000) appends the matching owner_funds_events application/reversal lineage in the same transaction.';

notify pgrst, 'reload schema';
commit;
