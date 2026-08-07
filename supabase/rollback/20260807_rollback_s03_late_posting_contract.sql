begin;

drop trigger if exists trg_gl_derive_posting_metadata on public.journal_batches;
drop function if exists public.gl_derive_posting_metadata();

alter table public.journal_batches
  drop column if exists late_posting,
  drop column if exists posting_date;

commit;
