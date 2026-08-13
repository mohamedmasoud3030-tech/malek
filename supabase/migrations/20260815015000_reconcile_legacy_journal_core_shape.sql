-- Reconcile the live S03 journal hotfix shape with the canonical Stage 3
-- journal contract without replacing or re-posting any financial row.
-- Existing batches and lines are projected into the canonical columns; legacy
-- evidence columns remain available. Canonical databases are a no-op.

do $reconcile$
declare
  v_unresolved bigint;
begin
  if to_regclass('public.journal_batches') is null
     or to_regclass('public.journal_lines') is null
     or exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'journal_batches'
         and column_name = 'period_resolution_reason'
     ) then
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'journal_batches'
      and column_name = 'state'
  ) then
    raise exception 'UNKNOWN_JOURNAL_BATCH_SHAPE' using errcode = 'P0001';
  end if;

  select count(*) into v_unresolved
  from public.journal_batches b
  where not exists (
    select 1
    from public.accounting_periods p
    where p.company_id = b.company_id
      and b.effective_date between p.start_date and p.end_date
  );

  if v_unresolved <> 0 then
    raise exception 'JOURNAL_BATCH_PERIOD_RECONCILIATION_FAILED: % unresolved batches',
      v_unresolved using errcode = 'P0001';
  end if;

  alter table public.journal_batches
    add column status text,
    add column is_legacy_compat boolean not null default false,
    add column accounting_period_id uuid,
    add column period_resolution_reason text,
    add column posted_by uuid,
    add column description text,
    add column updated_at timestamptz not null default now();

  -- The live S03 immutability trigger correctly blocks ordinary edits to
  -- posted batches. This migration is a one-time structural projection, not a
  -- financial mutation, so suspend that exact legacy trigger inside the same
  -- transaction and restore it immediately after the canonical columns are
  -- populated. Any failure rolls the trigger state back with the transaction.
  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.journal_batches'::regclass
      and tgname = 'journal_batches_immutability'
      and not tgisinternal
  ) then
    alter table public.journal_batches
      disable trigger journal_batches_immutability;
  end if;

  update public.journal_batches b
  set status = b.state,
      accounting_period_id = p.id,
      period_resolution_reason = 'live_s03_period_contains_effective_date',
      posted_by = b.created_by,
      description = b.memo,
      updated_at = greatest(
        b.created_at,
        coalesce(b.posted_at, b.created_at),
        coalesce(b.reversed_at, b.created_at)
      )
  from public.accounting_periods p
  where p.company_id = b.company_id
    and b.effective_date between p.start_date and p.end_date;

  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.journal_batches'::regclass
      and tgname = 'journal_batches_immutability'
      and not tgisinternal
  ) then
    alter table public.journal_batches
      enable trigger journal_batches_immutability;
  end if;

  alter table public.journal_batches
    alter column status set default 'DRAFT',
    alter column status set not null,
    alter column source_id set default '',
    alter column source_id set not null;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.journal_batches'::regclass
      and conname = 'journal_batches_event_uidx'
  ) then
    alter table public.journal_batches
      add constraint journal_batches_event_uidx
      unique (company_id, source_type, source_id, event_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.journal_batches'::regclass
      and conname = 'journal_batches_accounting_period_id_fkey'
  ) then
    alter table public.journal_batches
      add constraint journal_batches_accounting_period_id_fkey
      foreign key (accounting_period_id)
      references public.accounting_periods(id)
      on delete restrict;
  end if;

  alter table public.journal_lines
    add column no text,
    add column date text,
    add column line_description text,
    add column ref_source_id text,
    add column ref_entity_type text,
    add column ref_entity_id text,
    add column request_id text,
    add column deleted_at timestamptz;

  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.journal_lines'::regclass
      and tgname = 'journal_lines_immutability'
      and not tgisinternal
  ) then
    alter table public.journal_lines
      disable trigger journal_lines_immutability;
  end if;

  update public.journal_lines l
  set no = l.line_no::text,
      date = b.effective_date::text,
      line_description = l.description,
      ref_source_id = b.source_id,
      ref_entity_type = l.entity_type,
      ref_entity_id = l.entity_id
  from public.journal_batches b
  where b.id = l.batch_id;

  if exists (
    select 1 from pg_trigger
    where tgrelid = 'public.journal_lines'::regclass
      and tgname = 'journal_lines_immutability'
      and not tgisinternal
  ) then
    alter table public.journal_lines
      enable trigger journal_lines_immutability;
  end if;

end;
$reconcile$;
