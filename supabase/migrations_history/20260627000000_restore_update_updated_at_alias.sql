-- Restore the canonical updated_at trigger helper before later migrations replay.
--
-- The code-first baseline defines public.touch_updated_at(), while historical
-- migrations for cost centers and payment terms reference public.update_updated_at().
-- Keeping this compatibility helper in migration order makes clean database
-- replays deterministic without changing table shape, RLS, RPCs, or financial logic.

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
