begin;

do $preflight$
declare
  v_details text;
begin
  select string_agg(id::text, ', ' order by id::text)
    into v_details
  from public.units
  where property_id is null
     or nullif(btrim(unit_number), '') is null
     or status is null;
  if v_details is not null then
    raise exception 'Incomplete unit rows: %', v_details;
  end if;

  select string_agg(format('%s/%s', property_id, normalized_number), ', ' order by property_id, normalized_number)
    into v_details
  from (
    select property_id, lower(btrim(unit_number)) as normalized_number
    from public.units
    where deleted_at is null
    group by property_id, lower(btrim(unit_number))
    having count(*) > 1
  ) duplicates;
  if v_details is not null then
    raise exception 'Duplicate unit numbers: %', v_details;
  end if;

  select string_agg(c.id::text, ', ' order by c.id::text)
    into v_details
  from public.contracts c
  join public.units u on u.id = c.unit_id
  where c.property_id is distinct from u.property_id;
  if v_details is not null then
    raise exception 'Contract/unit property mismatches: %', v_details;
  end if;
end
$preflight$;

alter table public.units
  alter column property_id set not null,
  alter column unit_number set not null,
  alter column status set default 'available',
  alter column status set not null;

alter table public.units
  drop constraint if exists units_unit_number_nonblank_check,
  add constraint units_unit_number_nonblank_check check (length(btrim(unit_number)) > 0);

create unique index if not exists units_property_unit_number_active_uidx
  on public.units (property_id, lower(btrim(unit_number)))
  where deleted_at is null;

alter table public.units
  drop constraint if exists units_id_property_key,
  add constraint units_id_property_key unique (id, property_id);

alter table public.contracts
  drop constraint if exists contracts_unit_property_fkey,
  add constraint contracts_unit_property_fkey
    foreign key (unit_id, property_id)
    references public.units (id, property_id)
    on update cascade
    on delete restrict;

commit;
