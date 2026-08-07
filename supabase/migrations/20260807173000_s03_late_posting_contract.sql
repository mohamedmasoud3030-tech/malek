-- Stage S03 — make accounting-period redirection explicit on canonical journal batches.
-- Forward-only migration. Business RPC wiring remains a separate follow-up.

begin;

alter table public.journal_batches
  add column if not exists posting_date date,
  add column if not exists late_posting boolean not null default false;

comment on column public.journal_batches.posting_date is
  'Server-derived GL posting date. Equals effective_date in the containing OPEN period; for redirected late events it equals the receiving OPEN period start_date.';
comment on column public.journal_batches.late_posting is
  'True only when the canonical posting engine redirects an event from its effective period to the earliest eligible OPEN period.';

create or replace function public.gl_derive_posting_metadata()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_period_start date;
begin
  -- Only canonical period-resolved postings participate. Legacy compatibility
  -- batches intentionally remain outside this contract until their writers are
  -- migrated to the Stage-3 engine.
  if new.status = 'POSTED' and new.accounting_period_id is not null then
    select p.start_date
      into v_period_start
      from public.accounting_periods p
     where p.id = new.accounting_period_id
       and p.company_id = new.company_id;

    if v_period_start is null then
      raise exception 'GL_POSTING_PERIOD_SCOPE: accounting period % is missing or outside company %.',
        new.accounting_period_id, new.company_id
        using errcode = '22023';
    end if;

    new.late_posting := (new.period_resolution_reason = 'redirected_earliest_open_period');
    new.posting_date := case
      when new.late_posting then v_period_start
      else new.effective_date
    end;
  elsif new.status <> 'POSTED' then
    new.late_posting := false;
    new.posting_date := null;
  end if;

  return new;
end;
$function$;

alter function public.gl_derive_posting_metadata() owner to postgres;
revoke all on function public.gl_derive_posting_metadata() from public, anon, authenticated;
grant execute on function public.gl_derive_posting_metadata() to service_role;

drop trigger if exists trg_gl_derive_posting_metadata on public.journal_batches;
create trigger trg_gl_derive_posting_metadata
before insert or update of status, accounting_period_id, period_resolution_reason, effective_date
on public.journal_batches
for each row execute function public.gl_derive_posting_metadata();

-- Backfill already-posted canonical batches without touching legacy compatibility
-- postings that have no resolved accounting period.
update public.journal_batches b
   set late_posting = (b.period_resolution_reason = 'redirected_earliest_open_period'),
       posting_date = case
         when b.period_resolution_reason = 'redirected_earliest_open_period' then p.start_date
         else b.effective_date
       end
  from public.accounting_periods p
 where b.status = 'POSTED'
   and b.accounting_period_id = p.id
   and p.company_id = b.company_id
   and (b.posting_date is null
        or b.late_posting is distinct from (b.period_resolution_reason = 'redirected_earliest_open_period'));

commit;
