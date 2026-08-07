-- Manual/emergency rollback only — not auto-applied; run by hand only.
-- Rollback for: supabase/migrations/20260807175000_s03_receipt_reversal_compatibility_projection.sql
--
-- This restores the pre-projection compatibility view only. It never changes
-- canonical journal batches/lines or reversals already posted by the GL engine.

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
  l.ref_entity_type as entity_type,
  l.ref_entity_id as entity_id,
  l.created_at,
  b.company_id,
  b.id as batch_id,
  l.request_id,
  case b.status when 'DRAFT' then 'draft' else 'posted' end as status,
  l.deleted_at
from public.journal_lines l
join public.journal_batches b on b.id = l.batch_id;

alter view public.journal_entries owner to postgres;
alter view public.journal_entries alter column company_id set default public.current_company_id();
alter view public.journal_entries alter column created_at set default now();
grant select on public.journal_entries to authenticated;

commit;
