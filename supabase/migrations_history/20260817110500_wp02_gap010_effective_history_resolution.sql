-- WP-02 / GAP-010 follow-up: preserve authoritative historical tax versions
-- when a later effective-dated profile is activated.
--
-- The initial GAP-010 lifecycle marks an overlapping ACTIVE profile as
-- SUPERSEDED before activating its successor. A superseded profile is still the
-- authoritative historical version for dates before the successor's
-- effective_from, so its effective window must be closed and the resolver must
-- consider that historical status.

begin;

create or replace function public.close_superseded_tax_profile_windows()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if new.status <> 'ACTIVE' or old.status = 'ACTIVE' then
    return new;
  end if;

  -- Activation is version-forward. Refuse a back-dated/equal-date activation
  -- that would make a previously active later version ambiguous.
  if exists (
    select 1
      from public.company_tax_profiles p
     where p.company_id = new.company_id
       and p.id <> new.id
       and p.status = 'SUPERSEDED'
       and p.effective_from >= new.effective_from
       and (p.effective_to is null or p.effective_to >= new.effective_from)
  ) then
    raise exception 'TAX_PROFILE_ACTIVATION_ORDER_CONFLICT: activation date % must be later than the profile it supersedes.',
      new.effective_from using errcode = '22023';
  end if;

  -- Preserve the predecessor as historical authority while removing the
  -- overlap with the newly-active version.
  update public.company_tax_profiles p
     set effective_to = new.effective_from - 1,
         updated_at = now()
   where p.company_id = new.company_id
     and p.id <> new.id
     and p.status = 'SUPERSEDED'
     and p.effective_from < new.effective_from
     and (p.effective_to is null or p.effective_to >= new.effective_from);

  return new;
end;
$fn$;

alter function public.close_superseded_tax_profile_windows() owner to postgres;
revoke all on function public.close_superseded_tax_profile_windows() from public, anon, authenticated;
grant execute on function public.close_superseded_tax_profile_windows() to service_role;

drop trigger if exists trg_close_superseded_tax_profile_windows on public.company_tax_profiles;
create trigger trg_close_superseded_tax_profile_windows
  after update of status on public.company_tax_profiles
  for each row
  when (old.status is distinct from new.status and new.status = 'ACTIVE')
  execute function public.close_superseded_tax_profile_windows();

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
       and p.status in ('APPROVED','ACTIVE','SUPERSEDED')
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
