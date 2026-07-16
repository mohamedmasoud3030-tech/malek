-- Align the legacy utility_bills property reference with the canonical
-- public.properties.id type used by the live Rentrix schema.
--
-- UUID values have a lossless text representation. The live table was verified
-- empty before this forward migration was authored, while the USING expression
-- keeps the migration safe for any future replay that already has rows.

begin;

alter table public.utility_bills
  drop constraint if exists utility_bills_property_id_fkey;

alter table public.utility_bills
  alter column property_id type text
  using property_id::text;

alter table public.utility_bills
  add constraint utility_bills_property_id_fkey
  foreign key (property_id)
  references public.properties(id)
  on delete cascade;

commit;
