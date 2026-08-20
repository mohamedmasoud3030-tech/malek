-- ============================================================================
-- Rollback for: 20260731190947_create_maintenance_atomic_rpc.sql
-- ============================================================================
--
-- Reverses the column adds, the index, the RLS tightening, and drops the
-- create_maintenance_atomic RPC. The application can be re-deployed without
-- the new code path; raw INSERTs become the write path again.
-- ============================================================================

begin;

-- Drop the RLS tightening
drop policy if exists manager_write_maintenance_records on public.maintenance_records;
create policy manager_write_maintenance_records on public.maintenance_records
  for all to authenticated
  using (public.is_admin_or_manager())
  with check (public.is_admin_or_manager());

-- Drop the function
drop function if exists public.create_maintenance_atomic(
  text, text, text, text, text, text, text, date, text, text
);

-- Drop the index
drop index if exists public.maintenance_records_company_request_id_key;

-- Drop the default and the column. The backfilled values remain in
-- place in the column until the column itself is dropped, so the
-- rollback is safe to rerun.
alter table public.maintenance_records
  alter column company_id drop default;

alter table public.maintenance_records
  drop column if exists request_id;

-- Note: company_id is intentionally left in place. It was added in
-- Phase 2 and is used by other tables and policies; dropping it here
-- would create a wider regression than the maintenance RPC change
-- is responsible for.

commit;
