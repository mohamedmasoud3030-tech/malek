-- ============================================================================
-- Manual rollback — not auto-applied; run by hand only in an emergency.
-- Rollback for: 20260805110000_s02_document_reference_trigger_resilience.sql
--
-- Restores the pre-S02 body of public.assign_document_reference() exactly as
-- recorded in 20260805000000_business_document_references.sql. NOTE: that
-- body reads NEW.created_at directly, so running this rollback re-introduces
-- the 42703 failure for bank_statement_imports. Apply only when a later
-- forward repair is already in place or the table trigger is detached.
-- ============================================================================

begin;

create or replace function public.assign_document_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_year    integer;
begin
  if NEW.reference is not null and NEW.reference <> '' then
    return NEW;
  end if;

  v_company := coalesce(
    NEW.company_id,
    (select c.id from public.company_settings c where c.singleton_key = true limit 1)
  );
  if v_company is null then
    return NEW;
  end if;

  v_year := extract(year from coalesce(NEW.created_at, now()))::integer;

  NEW.reference := public.next_document_reference(
    v_company,
    TG_ARGV[0],
    TG_ARGV[1],
    v_year
  );
  return NEW;
end;
$$;

alter function public.assign_document_reference() owner to postgres;

revoke all on function public.assign_document_reference() from public, anon;
grant execute on function public.assign_document_reference() to authenticated, service_role;

commit;
