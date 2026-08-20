-- Applied live on nnggcnpcuomwfuupupwg with owner approval, 2026-07-18.
-- Pins search_path on the set_updated_at trigger function, bringing it in
-- line with every other function in public. Not SECURITY DEFINER, so blast
-- radius was already limited, but this was the only function in public
-- lacking a pinned search_path (see docs/CURRENT_STATE.md, "Supabase
-- drift-check pass and live schema fixes (2026-07-18)").
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;
