-- Hot-path FK covering indexes (additive, concurrent-safe via IF NOT EXISTS).
--
-- Evidence: scripts/supabase-tests/schema-inventory.mjs reports 102 public FKs
-- without a supporting index. Tenant tables received company_id + FK constraints
-- in the 20260722 multi-tenant series, but many never received a leading
-- company_id index. RLS and almost every browser list filter on company_id
-- (via current_company_id()), so sequential scans dominate as row counts grow.
--
-- Also covers relationship keys used by high-traffic PostgREST selects:
-- receipt_allocations.receipt_id (receipt enrichment), settlement link
-- settlement_id (owner settlement workspace), and maintenance expense/invoice
-- reverse lookups.
--
-- Safety:
--   * CREATE INDEX IF NOT EXISTS only — no data rewrite, no constraint change.
--   * Partial indexes where soft-delete is the normal list filter.
--   * Reversible: DROP INDEX IF EXISTS in the reverse order of creation.
--   * Does not enable/disable RLS or alter grants.
--   * Late-added tables/columns are guarded so historical replay baselines can
--     apply this additive migration without assuming future schema objects.

-- ── Tenant-scoped operational registers (company_id leading) ───────────────

create index if not exists properties_company_id_idx
  on public.properties (company_id)
  where deleted_at is null;

create index if not exists units_company_id_idx
  on public.units (company_id)
  where deleted_at is null;

create index if not exists people_company_id_idx
  on public.people (company_id)
  where deleted_at is null;

create index if not exists owners_company_id_idx
  on public.owners (company_id)
  where deleted_at is null;

create index if not exists property_owners_company_id_idx
  on public.property_owners (company_id);

create index if not exists contracts_company_id_idx
  on public.contracts (company_id)
  where deleted_at is null;

create index if not exists invoices_company_id_idx
  on public.invoices (company_id)
  where deleted_at is null;

create index if not exists payments_company_id_idx
  on public.payments (company_id)
  where deleted_at is null;

create index if not exists expenses_company_id_idx
  on public.expenses (company_id)
  where deleted_at is null;

create index if not exists maintenance_records_company_id_idx
  on public.maintenance_records (company_id)
  where deleted_at is null;

create index if not exists communication_records_company_id_idx
  on public.communication_records (company_id)
  where deleted_at is null;

create index if not exists leads_company_id_idx
  on public.leads (company_id);

create index if not exists vault_documents_company_id_idx
  on public.vault_documents (company_id)
  where deleted_at is null;

create index if not exists utility_meters_company_id_idx
  on public.utility_meters (company_id)
  where deleted_at is null;

create index if not exists utility_bills_company_id_idx
  on public.utility_bills (company_id)
  where deleted_at is null;

create index if not exists deposit_transactions_company_id_idx
  on public.deposit_transactions (company_id);

create index if not exists bank_reconciliation_matches_company_id_idx
  on public.bank_reconciliation_matches (company_id);

-- ── Relationship keys used by nested / reverse lookups ─────────────────────

-- receiptService loads allocations by receipt_id in a batch .in() after listing
-- payments. Only invoice_id was indexed historically.
create index if not exists receipt_allocations_receipt_id_idx
  on public.receipt_allocations (receipt_id);

create index if not exists receipt_allocations_company_id_idx
  on public.receipt_allocations (company_id);

-- Settlement workspace joins links by settlement_id. Some historical replay
-- baselines intentionally stop before these link tables were introduced, so
-- guard their additive indexes rather than making old baselines depend on a
-- future table.
do $$
begin
  if to_regclass('public.owner_settlement_payment_links') is not null then
    execute 'create index if not exists owner_settlement_payment_links_settlement_company_idx on public.owner_settlement_payment_links (settlement_id, company_id)';
  end if;

  if to_regclass('public.owner_settlement_expense_links') is not null then
    execute 'create index if not exists owner_settlement_expense_links_settlement_company_idx on public.owner_settlement_expense_links (settlement_id, company_id)';
  end if;
end
$$;

-- Maintenance reverse links used when resolving cost / invoice context.
create index if not exists maintenance_records_expense_id_idx
  on public.maintenance_records (expense_id)
  where expense_id is not null;

create index if not exists maintenance_records_invoice_id_idx
  on public.maintenance_records (invoice_id)
  where invoice_id is not null;

-- Deposit reverse-link for compensating reversals. The column was introduced
-- after some phase replay fixtures; create the index only when that column is
-- actually present in the replayed schema.
do $$
begin
  if to_regclass('public.deposit_transactions') is not null
     and exists (
       select 1
       from pg_attribute
       where attrelid = to_regclass('public.deposit_transactions')
         and attname = 'reversal_of_id'
         and not attisdropped
     ) then
    execute 'create index if not exists deposit_transactions_reversal_of_id_idx on public.deposit_transactions (reversal_of_id) where reversal_of_id is not null';
  end if;
end
$$;
