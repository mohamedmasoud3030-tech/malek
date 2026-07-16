-- Align the legacy utility_bills property reference with the identifier type
-- that public.properties actually uses in the target environment.
--
-- Historical production uses text identifiers while a clean migration replay
-- uses uuid, so this migration intentionally detects rather than assumes type.

begin;

do $$
declare
  canonical_type text;
  bill_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
    into canonical_type
  from pg_attribute attribute
  where attribute.attrelid = 'public.properties'::regclass
    and attribute.attname = 'id'
    and not attribute.attisdropped;

  select format_type(attribute.atttypid, attribute.atttypmod)
    into bill_type
  from pg_attribute attribute
  where attribute.attrelid = 'public.utility_bills'::regclass
    and attribute.attname = 'property_id'
    and not attribute.attisdropped;

  if canonical_type is null or bill_type is null then
    raise exception 'Cannot resolve utility bill/property identifier types';
  end if;

  alter table public.utility_bills
    drop constraint if exists utility_bills_property_id_fkey;

  if bill_type <> canonical_type then
    execute format(
      'alter table public.utility_bills alter column property_id type %s using property_id::text::%s',
      canonical_type,
      canonical_type
    );
  end if;

  alter table public.utility_bills
    add constraint utility_bills_property_id_fkey
    foreign key (property_id)
    references public.properties(id)
    on delete cascade;
end
$$;

commit;
