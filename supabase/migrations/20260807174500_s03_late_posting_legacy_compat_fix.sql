-- Stage S03 corrective migration — normalize late-posting metadata for POSTED
-- batches when the period-resolution reason is absent and for compatibility
-- batches that intentionally have no accounting_period_id.
--
-- #1387 introduced late_posting NOT NULL and canonical posting metadata. A
-- manually-created POSTED batch can legitimately carry an accounting_period_id
-- while period_resolution_reason is NULL (for example the deferred-balance
-- enforcement test), and legacy compatibility batches intentionally have no
-- accounting period. In either case the trigger must never assign NULL to the
-- NOT NULL late_posting column.

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

    new.late_posting := coalesce(
      new.period_resolution_reason = 'redirected_earliest_open_period',
      false
    );
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
  'Derives canonical posting_date/late_posting for period-resolved POSTED batches, treating an absent resolution reason as not-late, and normalizes legacy POSTED/no-period batches to late_posting=false with no posting_date.';

commit;
