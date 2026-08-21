-- A unit may have only one live lease draft for a given tenant within a company.
-- This is a database invariant (not only a UI/service check), so direct RPC
-- callers and concurrent requests cannot create a duplicate draft.
--
-- Existing duplicates must be resolved deliberately before this migration is
-- applied. The production duplicate found on 2026-08-21 was soft-archived
-- through an owner-approved, separately recorded operation; application/demo
-- data is intentionally not embedded in this schema migration.
create unique index if not exists contracts_one_live_draft_per_unit_tenant_uidx
  on public.contracts (company_id, unit_id, tenant_id)
  where deleted_at is null
    and unit_id is not null
    and lower(status) = 'draft';
