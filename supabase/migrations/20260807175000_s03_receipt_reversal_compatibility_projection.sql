-- Stage S03 — preserve the historical journal_entries read contract for receipt VOID
-- while keeping the canonical stored reversal fully engine-managed.
--
-- reverse_journal_batch() intentionally copies immutable source references from
-- the original lines. Legacy readers, however, identify receipt reversals with
-- entity_type='receipt_void' and entity_id=<receipt_id>. Project that legacy
-- label in the compatibility VIEW only; canonical journal_lines remain unchanged.

begin;

create or replace view public.journal_entries
with (security_invoker = true) as
select
  l.id,
  l.no,
  l.date,
  l.account_id,
  case when l.debit > 0 then l.debit else l.credit end as amount,
  case when l.debit > 0 then 'DEBIT' else 'CREDIT' end as type,
  l.ref_source_id as source_id,
  case
    when b.source_type = 'journal_reversal'
      and original_batch.source_type = 'receipt'
      then 'receipt_void'
    else l.ref_entity_type
  end as entity_type,
  case
    when b.source_type = 'journal_reversal'
      and original_batch.source_type = 'receipt'
      then original_batch.source_id
    else l.ref_entity_id
  end as entity_id,
  l.created_at,
  b.company_id,
  b.id as batch_id,
  l.request_id,
  case b.status when 'DRAFT' then 'draft' else 'posted' end as status,
  l.deleted_at
from public.journal_lines l
join public.journal_batches b on b.id = l.batch_id
left join public.journal_batches original_batch
  on original_batch.id = b.reversal_of_batch_id
 and original_batch.company_id = b.company_id;

alter view public.journal_entries owner to postgres;
alter view public.journal_entries alter column company_id set default public.current_company_id();
alter view public.journal_entries alter column created_at set default now();
grant select on public.journal_entries to authenticated;

comment on view public.journal_entries is
  'Stage 3 compatibility projection over canonical journal lines/batches. Receipt reversal rows are projected as receipt_void for legacy readers without mutating canonical reversal references.';

commit;
