-- Applied live on nnggcnpcuomwfuupupwg with owner approval, 2026-07-18.
-- utility_bills.unit_id, tenant_deposits.property_id, and
-- tenant_deposits.unit_id are FK columns that had no supporting index,
-- unlike their sibling FK columns on the same tables. Partial indexes
-- match the existing indexing convention on both tables
-- (see docs/CURRENT_STATE.md, "Supabase drift-check pass and live schema
-- fixes (2026-07-18)").
create index if not exists idx_utility_bills_unit_id
  on public.utility_bills using btree (unit_id)
  where deleted_at is null;

create index if not exists idx_tenant_deposits_property
  on public.tenant_deposits using btree (property_id)
  where deleted_at is null;

create index if not exists idx_tenant_deposits_unit
  on public.tenant_deposits using btree (unit_id)
  where deleted_at is null;
