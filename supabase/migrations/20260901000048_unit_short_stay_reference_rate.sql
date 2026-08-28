-- A unit may carry an optional Short Stay daily reference rate.
-- It is a suggestion/snapshot source only; the contract's negotiated total
-- remains the commercial obligation and is never constrained by this value.

begin;

alter table public.units
  add column if not exists daily_reference_rate numeric(18,3);

alter table public.units
  drop constraint if exists units_daily_reference_rate_check;

alter table public.units
  add constraint units_daily_reference_rate_check
  check (
    daily_reference_rate is null
    or (
      daily_reference_rate >= 0
      and daily_reference_rate = round(daily_reference_rate, 3)
    )
  );

comment on column public.units.daily_reference_rate is
  'Optional Short Stay reference rate in OMR/day. Informational only; contract rent_amount remains authoritative.';

commit;
