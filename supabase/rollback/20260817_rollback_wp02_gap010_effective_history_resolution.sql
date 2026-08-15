-- Manual rollback for 20260817110500_wp02_gap010_effective_history_resolution.sql
-- Restores the resolver behavior from the initial GAP-010 migration and removes
-- the effective-window close trigger. This rollback does not mutate profile data.

begin;

drop trigger if exists trg_close_superseded_tax_profile_windows on public.company_tax_profiles;
drop function if exists public.close_superseded_tax_profile_windows();

create or replace function public.resolve_active_tax_profile(
  p_company_id uuid,
  p_effective_date date
)
returns table (
  profile_id uuid,
  tax_code text,
  tax_rate numeric,
  effective_from date,
  effective_to date
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if p_company_id is null or p_effective_date is null then
    raise exception 'TAX_PROFILE_RESOLVE_INPUT_REQUIRED' using errcode = '22023';
  end if;

  return query
    select p.id, p.tax_code, p.tax_rate, p.effective_from, p.effective_to
      from public.company_tax_profiles p
     where p.company_id = p_company_id
       and p.status in ('APPROVED','ACTIVE')
       and p.effective_from <= p_effective_date
       and (p.effective_to is null or p_effective_date <= p.effective_to)
     order by p.effective_from desc, p.version_no desc
     limit 1;

  if not found then
    raise exception 'TAX_PROFILE_MISSING: no authoritative tax profile covers %, company %. Posting blocked.',
      p_effective_date, p_company_id using errcode = 'P0001';
  end if;
end;
$fn$;

alter function public.resolve_active_tax_profile(uuid, date) owner to postgres;
revoke all on function public.resolve_active_tax_profile(uuid, date) from public, anon;
grant execute on function public.resolve_active_tax_profile(uuid, date) to authenticated, service_role;

commit;
