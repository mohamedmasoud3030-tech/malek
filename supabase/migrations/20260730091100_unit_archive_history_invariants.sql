begin;

create or replace function public.guard_unit_archive_history()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if old.deleted_at is not null or new.deleted_at is null then
    return new;
  end if;

  if exists (
    select 1
    from public.contracts c
    where c.unit_id::text = new.id::text
      and c.company_id = new.company_id
  ) then
    raise exception 'Unit with contract history cannot be archived.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.maintenance_records m
    where m.unit_id::text = new.id::text
      and m.company_id = new.company_id
      and m.deleted_at is null
      and lower(coalesce(m.status, '')) in ('open', 'in_progress')
  ) then
    raise exception 'Unit cannot be archived while maintenance is open.'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_unit_archive_history()
  from public, anon, authenticated;

drop trigger if exists units_archive_guard on public.units;
create trigger units_archive_guard
before update of deleted_at on public.units
for each row execute function public.guard_unit_archive_history();

commit;
