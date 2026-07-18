-- Applied live on nnggcnpcuomwfuupupwg with owner approval, 2026-07-18.
-- Production already contained this unit-status compatibility trigger when the
-- original migration pinned its search_path, but the historical replay chain
-- did not contain the function definition. Capture the exact live contract so
-- clean databases and production converge on the same secured object.

create or replace function public.normalize_unit_status_contract()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  canonical_status text;
begin
  canonical_status := case btrim(lower(new.status::text))
    when 'available' then 'available'
    when 'occupied' then 'occupied'
    when 'rented' then 'occupied'
    when 'maintenance' then 'maintenance'
    when 'reserved' then 'reserved'
    else null
  end;

  if canonical_status is null then
    raise exception 'Unsupported public.units.status value: %', new.status;
  end if;

  new.status := canonical_status;
  return new;
end;
$function$;

drop trigger if exists units_normalize_status_contract on public.units;
create trigger units_normalize_status_contract
before insert or update of status on public.units
for each row execute function public.normalize_unit_status_contract();
