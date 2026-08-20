-- WP-03 / GAP-004 (part 3): revoke direct contract writes from the API.
-- Canonical rules: OPS-006, SEC-003, SEC-009.
--
-- Before this migration an authenticated ADMIN/MANAGER could bypass the
-- canonical lifecycle entirely by issuing a raw PostgREST write against
-- public.contracts (e.g. `.from('contracts').insert({status:'active'})` or
-- `.update({status:'active'})`), because the legacy `manager_write_contracts`
-- policy granted `for all` to `authenticated` and `authenticated` held table
-- INSERT/UPDATE/DELETE privileges. The browser code already routes every
-- contract write through the dedicated SECURITY DEFINER atomic RPCs
-- (create_contract_atomic, update_contract_atomic, renew_contract_atomic,
-- terminate_contract_atomic, soft_delete_contract_atomic) — see
-- rentrix-app/src/test/db-contract/contract-writes-bypass.test.ts — but server
-- enforcement is mandatory even if the UI prevents the transition.
--
-- This migration makes the database the boundary:
--   * drops the `manager_write_contracts` `for all` policy;
--   * revokes INSERT/UPDATE/DELETE (and TRUNCATE/REFERENCES) on contracts from
--     `authenticated` and `anon`, keeping SELECT for read/RLS;
--   * service_role keeps full access (server-side automation).
--
-- Every contract write now must go through the SECURITY DEFINER lifecycle
-- RPCs, which enforce maker-checker approval, the agreement snapshot freeze,
-- lifecycle-status preservation and company isolation.
--
-- Rollback: supabase/rollback/20260818040000_rollback_wp03_gap004_contract_direct_write_revocation.sql

begin;

-- 1. Drop the legacy broad-write policy that let authenticated users write
--    contracts directly (bypassing the lifecycle RPCs).
drop policy if exists manager_write_contracts on public.contracts;

-- 2. Revoke direct write privileges from the API roles. SELECT is retained so
--    the read/RLS surface (app_read_contracts) keeps working.
revoke insert, update, delete, truncate, references on table public.contracts from authenticated;
revoke insert, update, delete, truncate, references on table public.contracts from anon;

-- 3. Keep read access for authenticated (already granted) and confirm grants.
grant select on table public.contracts to authenticated;

commit;
