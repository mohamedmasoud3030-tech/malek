-- Migration-history marker for the live PostgREST AI RPC cache repair applied
-- through the Supabase management API on 2026-08-30.
--
-- Intentionally a no-op on clean rebuilds because this timestamp sorts before
-- the 20260901000000 canonical baseline where the AI control functions are
-- defined. The canonical, rebuild-safe repair is repeated after the baseline in
-- 20260901000068_ai_assistant_postgrest_rpc_repair.sql.
--
-- Keeping this version in source control prevents remote/local migration-history
-- drift without attempting to reference functions that do not exist yet on a
-- clean database.

select 1;
