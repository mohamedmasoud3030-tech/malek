-- Stage S03 corrective migration — normalize late-posting metadata for POSTED
-- compatibility batches that intentionally have no accounting_period_id.
--
-- #1387 introduced late_posting NOT NULL and canonical posting metadata, while
-- intentionally leaving legacy compatibility batches outside period resolution.
-- A POSTED/no-period row could therefore preserve an explicitly supplied NULL
-- late_posting value and fail with SQLSTATE 23502 before deferred GL balance
-- validation. Normalize that transitional state to late_posting=false while
-- keeping posting_date NULL so legacy batches remain outside the canonical
-- period contract.

begin;

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
  elsif new.status = 'POSTED' then
    -- Transitional legacy/compatibility batches deliberately do not participate
    -- in accounting-period resolution. They must still satisfy the NOT NULL
    -- storage contract without masquerading as period-resolved postings.
    new.late_posting := false;
    new.posting_date := null;
  else
    new.late_posting := false;
    new.posting_date := null;
  end if;

  return new;
end;
$function$;

alter function public.gl_derive_posting_metadata() owner to postgres;
revoke all on function public.gl_derive_posting_metadata() from public, anon, authenticated;
grant execute on function public.gl_derive_posting_metadata() to service_role;

comment on function public.gl_derive_posting_metadata() is
  'Derives canonical posting_date/late_posting for period-resolved POSTED batches and normalizes legacy POSTED/no-period batches to late_posting=false with no posting_date.';

commit;
