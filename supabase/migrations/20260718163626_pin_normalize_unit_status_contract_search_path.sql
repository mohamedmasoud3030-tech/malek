-- Applied live on nnggcnpcuomwfuupupwg with owner approval, 2026-07-18.
-- Pins search_path on the normalize_unit_status_contract trigger function,
-- the second (and last remaining) function in public without one
-- (see docs/CURRENT_STATE.md, "Supabase drift-check pass and live schema
-- fixes (2026-07-18)").
alter function public.normalize_unit_status_contract() set search_path = public, pg_temp;
