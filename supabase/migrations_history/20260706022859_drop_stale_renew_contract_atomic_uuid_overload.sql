-- The previous migration (20260706022048) used CREATE OR REPLACE FUNCTION
-- with old_contract_id changed from uuid to text (matching contracts.id's
-- actual type). Since the parameter type changed, Postgres created a second
-- overload instead of replacing the original, leaving two ambiguous
-- candidates for PostgREST's `rpc('renew_contract_atomic', ...)` call.
-- Drop the stale, broken uuid-argument overload so only the fixed
-- text-argument version remains.

drop function if exists public.renew_contract_atomic(uuid, jsonb);
