-- Manual/emergency rollback only — not auto-applied; run by hand only.
-- Rollback for: supabase/migrations/20260807174500_s03_late_posting_legacy_compat_fix.sql
--
-- Safety: do not restore the previous trigger behavior while any POSTED batch
-- could receive NULL late_posting under that definition: either it has no
-- accounting period, or it has a period but no period_resolution_reason.

begin;

do $safety$
begin
  if exists (
    select 1
      from public.journal_batches b
     where b.status = 'POSTED'
       and (
         b.accounting_period_id is null
         or b.period_resolution_reason is null
       )
  ) then
    raise exception 'S03_LATE_POSTING_ROLLBACK_BLOCKED: POSTED batches exist that are unsafe under the previous trigger definition; use a forward corrective migration instead.'
      using errcode = '55000';
  end if;
end
$safety$;

create or replace function public.gl_derive_posting_metadata()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_period_start date;
begin
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

commit;
